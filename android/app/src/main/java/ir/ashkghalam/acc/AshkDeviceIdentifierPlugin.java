package ir.ashkghalam.acc;

import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AshkDeviceIdentifier")
public class AshkDeviceIdentifierPlugin extends Plugin {
    @PluginMethod
    public void getId(PluginCall call) {
        try {
            String androidId = Settings.Secure.getString(
                getContext().getContentResolver(),
                Settings.Secure.ANDROID_ID
            );
            if (androidId == null || androidId.trim().isEmpty()) {
                call.reject("شناسه امن دستگاه اندروید در دسترس نیست.");
                return;
            }

            String packageName = getContext().getPackageName();
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                (packageName + "|" + androidId).getBytes(StandardCharsets.UTF_8)
            );
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                hex.append(String.format(java.util.Locale.ROOT, "%02X", value & 0xff));
            }

            JSObject result = new JSObject();
            result.put("id", "ASHK-ANDROID-" + hex);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("محاسبه شناسه امن دستگاه اندروید ناموفق بود.");
        }
    }
}
