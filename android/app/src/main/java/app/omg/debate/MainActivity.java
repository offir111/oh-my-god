package app.omg.debate;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * ⚠️  חץ חזרה — אסור לשנות התנהגות זו!
 * ─────────────────────────────────────────────────────────────────
 * בברירת מחדל, לחיצה על חץ חזרה של אנדרואיד כשאין היסטוריה תסגור
 * את האפליקציה. כדי למנוע זאת:
 *
 *   1. אם יש WebView history → goBack() (ניווט בין דפים ב-React Router)
 *   2. אם אין history:
 *        - לחיצה ראשונה → toast "לחץ שוב לצאת"
 *        - לחיצה שנייה תוך 2 שניות → finish() (יציאה מבוקרת)
 *
 * משתמשים ב-OnBackPressedDispatcher (API מודרני, מחליף את onBackPressed)
 * כי targetSdk = 34.
 * ─────────────────────────────────────────────────────────────────
 */
public class MainActivity extends BridgeActivity {

    private long backPressedTime = 0;

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        finishAndRemoveTask();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // אם יש דף קודם ב-WebView (React Router history) — חזור אליו
                if (getBridge() != null && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                    return;
                }

                // אין דף קודם — לחיצה כפולה לצאת
                long now = System.currentTimeMillis();
                if (now - backPressedTime < 2000) {
                    finish();  // יציאה מהאפליקציה
                } else {
                    Toast.makeText(MainActivity.this, "לחץ שוב כדי לצאת", Toast.LENGTH_SHORT).show();
                    backPressedTime = now;
                }
            }
        });
    }
}
