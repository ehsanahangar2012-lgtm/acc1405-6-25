package ir.ashkghalam.acc;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeBackup")
public class NativeBackupPlugin extends Plugin {
    @PluginMethod
    public void saveBackup(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        if (fileName == null || !fileName.matches("[A-Za-z0-9._-]{1,180}\\.(json|agbak)") || content == null) {
            call.reject("نام یا محتوای فایل پشتیبان معتبر نیست.");
            return;
        }
        if (content.length() > 180 * 1024 * 1024) {
            call.reject("حجم فایل پشتیبان از حد مجاز بیشتر است.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        String mimeType = call.getString("mimeType");
        intent.setType(mimeType == null ? "application/json" : mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "handleSaveBackupResult");
    }

    @ActivityCallback
    private void handleSaveBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("success", false);
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri uri = result.getData().getData();
        String content = call.getString("content");
        if (content == null) {
            call.reject("محتوای فایل پشتیبان در دسترس نیست.");
            return;
        }

        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) {
                call.reject("بازکردن مسیر انتخاب‌شده برای نوشتن ناموفق بود.");
                return;
            }
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            output.write(bytes);
            output.flush();

            JSObject response = new JSObject();
            response.put("success", true);
            response.put("uri", uri.toString());
            response.put("bytesWritten", bytes.length);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("ذخیره فایل پشتیبان در مسیر انتخاب‌شده ناموفق بود.", error);
        }
    }
}
