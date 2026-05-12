package app.omg.debate;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import java.io.IOException;

/**
 * Foreground Service for radio playback.
 * Keeps playing even when:
 *  - User switches to another app (home button)
 *  - Screen turns off
 *  - Notifications arrive
 * Pauses/resumes automatically for phone calls via AudioFocus.
 * Stops only when: user taps ✕ in app, notification stop button, or a
 * different app permanently takes audio focus.
 */
public class RadioPlayerService extends Service {

    public static final String ACTION_START      = "omg.radio.START";
    public static final String ACTION_STOP       = "omg.radio.STOP";
    public static final String ACTION_SET_VOLUME = "omg.radio.SET_VOLUME";
    public static final String EXTRA_URL         = "url";
    public static final String EXTRA_NAME        = "name";
    public static final String EXTRA_VOLUME      = "volume";

    private static final String CHANNEL_ID = "omg_radio";
    private static final int    NOTIF_ID   = 7331;

    private MediaPlayer         player;
    private AudioManager        audioManager;
    private AudioFocusRequest   focusRequest;   // API 26+
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock  wifiLock;

    private String  currentUrl  = "";
    private String  currentName = "רדיו";
    private float   userVolume  = 1.0f;
    private boolean isDucked    = false;

    // ── AudioFocus listener: handles phone calls and notification sounds ──
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        switch (change) {
            case AudioManager.AUDIOFOCUS_GAIN:
                // Call ended / notification gone → restore full volume and resume
                isDucked = false;
                if (player != null) {
                    player.setVolume(userVolume, userVolume);
                    if (!player.isPlaying()) player.start();
                }
                break;

            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                // Phone call incoming → pause (will resume when call ends)
                if (player != null && player.isPlaying()) player.pause();
                break;

            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                // Notification / GPS sound → duck to 15%
                isDucked = true;
                if (player != null) player.setVolume(userVolume * 0.15f, userVolume * 0.15f);
                break;

            case AudioManager.AUDIOFOCUS_LOSS:
                // Another app permanently took focus (e.g. Spotify) → stop
                stopSelf();
                break;
        }
    };

    // ── MediaPlayer error/completion → reconnect same URL ──
    private final MediaPlayer.OnErrorListener errorListener = (mp, what, extra) -> {
        mp.reset();
        reconnect();
        return true;
    };

    private final MediaPlayer.OnCompletionListener completionListener = mp -> {
        // Live streams shouldn't complete, but just in case
        reconnect();
    };

    private void reconnect() {
        if (currentUrl.isEmpty()) return;
        try {
            player.setDataSource(currentUrl);
            player.prepareAsync();
        } catch (IOException e) {
            stopSelf();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
        acquireLocks();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (action == null) return START_NOT_STICKY;

        switch (action) {
            case ACTION_START:
                String url  = intent.getStringExtra(EXTRA_URL);
                String name = intent.getStringExtra(EXTRA_NAME);
                if (name != null && !name.isEmpty()) currentName = name;
                startPlaying(url);
                break;

            case ACTION_STOP:
                stopSelf();
                break;

            case ACTION_SET_VOLUME:
                float vol = intent.getFloatExtra(EXTRA_VOLUME, 1.0f);
                applyVolume(vol);
                break;
        }
        return START_NOT_STICKY;
    }

    // ── Playback ──────────────────────────────────────────────────────────────

    private void startPlaying(String url) {
        if (url == null || url.isEmpty()) return;

        // If same URL already playing → just update notification, no restart
        if (url.equals(currentUrl) && player != null && player.isPlaying()) {
            updateNotification();
            return;
        }

        currentUrl = url;

        // Post foreground notification immediately (avoids ANR / "Context.startForegroundService() did not then call Service.startForeground()")
        Notification notif = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        requestAudioFocus();
        releasePlayer();

        player = new MediaPlayer();
        player.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build());
        player.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
        player.setOnErrorListener(errorListener);
        player.setOnCompletionListener(completionListener);
        player.setOnPreparedListener(mp -> {
            mp.setVolume(userVolume, userVolume);
            mp.start();
        });

        try {
            player.setDataSource(currentUrl);
            player.prepareAsync();
        } catch (IOException e) {
            stopSelf();
        }
    }

    private void applyVolume(float vol) {
        userVolume = Math.max(0f, Math.min(1f, vol));
        if (player != null && !isDucked) {
            player.setVolume(userVolume, userVolume);
        }
    }

    // ── AudioFocus ────────────────────────────────────────────────────────────

    private void requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build())
                .setOnAudioFocusChangeListener(focusListener)
                .setWillPauseWhenDucked(false) // we duck ourselves
                .build();
            audioManager.requestAudioFocus(focusRequest);
        } else {
            //noinspection deprecation
            audioManager.requestAudioFocus(focusListener,
                AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            //noinspection deprecation
            audioManager.abandonAudioFocus(focusListener);
        }
    }

    // ── Locks ─────────────────────────────────────────────────────────────────

    private void acquireLocks() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "omg:RadioWL");
            wakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours safety cap
        }
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "omg:RadioWifi");
            wifiLock.acquire();
        }
    }

    private void releaseLocks() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        try { if (wifiLock != null && wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "רדיו", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("ניגון רדיו ברקע");
            ch.setSound(null, null);
            ch.enableVibration(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        // Stop action in notification
        Intent stopIntent = new Intent(this, RadioPlayerService.class);
        stopIntent.setAction(ACTION_STOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent stopPi = PendingIntent.getService(this, 0, stopIntent, piFlags);

        // Tap notification → open app
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, openIntent, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentName)
            .setContentText("מנגן ברקע — לחץ לפתיחה")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "עצור", stopPi)
            .setOngoing(true)          // not swipe-dismissable
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification());
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    private void releasePlayer() {
        if (player != null) {
            try { if (player.isPlaying()) player.stop(); } catch (Exception ignored) {}
            player.release();
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        abandonAudioFocus();
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
