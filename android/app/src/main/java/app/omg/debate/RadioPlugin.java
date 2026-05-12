package app.omg.debate;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin: bridges JavaScript ↔ RadioPlayerService.
 *
 * JS usage (after registerPlugin):
 *   RadioPlayer.start({ url, name })
 *   RadioPlayer.stop()
 *   RadioPlayer.setVolume({ volume: 0.8 })
 */
@CapacitorPlugin(name = "RadioPlayer")
public class RadioPlugin extends Plugin {

    private void sendToService(Intent intent) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        String url  = call.getString("url",  "");
        String name = call.getString("name", "רדיו");
        if (url.isEmpty()) { call.reject("missing url"); return; }

        Intent i = new Intent(getContext(), RadioPlayerService.class);
        i.setAction(RadioPlayerService.ACTION_START);
        i.putExtra(RadioPlayerService.EXTRA_URL, url);
        i.putExtra(RadioPlayerService.EXTRA_NAME, name);
        sendToService(i);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent i = new Intent(getContext(), RadioPlayerService.class);
        i.setAction(RadioPlayerService.ACTION_STOP);
        sendToService(i);
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float vol = call.getFloat("volume", 1.0f);
        Intent i = new Intent(getContext(), RadioPlayerService.class);
        i.setAction(RadioPlayerService.ACTION_SET_VOLUME);
        i.putExtra(RadioPlayerService.EXTRA_VOLUME, vol);
        sendToService(i);
        call.resolve();
    }
}
