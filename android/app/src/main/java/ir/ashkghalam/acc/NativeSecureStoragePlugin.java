package ir.ashkghalam.acc;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NativeSecureStorage")
public class NativeSecureStoragePlugin extends Plugin {
    private static final String KEY_ALIAS = "AshkGhalam.Android.LocalData.AESGCM.v1";
    private static final String PREFS = "ashk-encrypted-local-storage-v1";
    private static final int GCM_TAG_BITS = 128;
    private static final int MAX_VALUE_BYTES = 80 * 1024 * 1024;

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
            throw new IllegalStateException("ANDROID_KEYSTORE_ENTRY_INVALID");
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .setKeySize(256)
                .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private boolean isValidKey(String key) {
        return key != null && key.matches("[A-Za-z0-9_.:-]{1,180}");
    }

    @PluginMethod
    public void getItem(PluginCall call) {
        String key = call.getString("key");
        if (!isValidKey(key)) {
            call.reject("کلید ذخیره‌سازی معتبر نیست.");
            return;
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String encoded = prefs.getString(key, null);
            JSObject response = new JSObject();
            if (encoded == null) {
                // Explicit presence flag: JSON encoders may omit null-valued fields.
                response.put("found", false);
                call.resolve(response);
                return;
            }
            String[] parts = encoded.split(":", 3);
            if (parts.length != 3 || !"v1".equals(parts[0])) {
                call.reject("ساختار داده امن ذخیره‌شده معتبر نیست.");
                return;
            }
            byte[] iv = Base64.decode(parts[1], Base64.NO_WRAP);
            byte[] ciphertext = Base64.decode(parts[2], Base64.NO_WRAP);
            if (iv.length != 12 || ciphertext.length < 16 || ciphertext.length > MAX_VALUE_BYTES + 16) {
                call.reject("طول داده رمزگذاری‌شده معتبر نیست.");
                return;
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] plaintext = cipher.doFinal(ciphertext);
            response.put("found", true);
            response.put("value", new String(plaintext, StandardCharsets.UTF_8));
            Arrays.fill(plaintext, (byte) 0);
            call.resolve(response);
        } catch (Exception error) {
            // Do not return the stored value or a plaintext fallback on decryption errors.
            call.reject("بازکردن داده محلی رمزگذاری‌شده ناموفق بود؛ اطلاعات دستکاری‌شده یا کلید در دسترس نیست.", error);
        }
    }

    @PluginMethod
    public void setItem(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (!isValidKey(key) || value == null) {
            call.reject("کلید یا مقدار ذخیره‌سازی معتبر نیست.");
            return;
        }
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);
        if (plaintext.length > MAX_VALUE_BYTES) {
            call.reject("داده از حد مجاز ذخیره‌سازی بیشتر است.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(plaintext);
            String encoded = "v1:" + Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                    Base64.encodeToString(ciphertext, Base64.NO_WRAP);
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean saved = prefs.edit().putString(key, encoded).commit();
            Arrays.fill(plaintext, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            if (!saved) {
                call.reject("ذخیره رمزگذاری‌شده روی دستگاه ناموفق بود.");
                return;
            }
            JSObject response = new JSObject();
            response.put("success", true);
            response.put("encryptedAtRest", true);
            call.resolve(response);
        } catch (Exception error) {
            Arrays.fill(plaintext, (byte) 0);
            call.reject("رمزگذاری یا ذخیره امن داده محلی ناموفق بود.", error);
        }
    }

    @PluginMethod
    public void removeItem(PluginCall call) {
        String key = call.getString("key");
        if (!isValidKey(key)) {
            call.reject("کلید ذخیره‌سازی معتبر نیست.");
            return;
        }
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean removed = prefs.edit().remove(key).commit();
            if (!removed) {
                call.reject("حذف داده امن محلی ناموفق بود.");
                return;
            }
            JSObject response = new JSObject();
            response.put("success", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("حذف داده امن محلی ناموفق بود.", error);
        }
    }
}
