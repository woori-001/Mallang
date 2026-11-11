package com.woori.mallang;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 앱 안에서 새 버전 알림 + 받아서 설치.
 * - 깃허브 'android-test' 릴리스의 android-version.json 을 보고, 위젯·앱 코드가 바뀐 새 빌드가 있으면 물어봄
 * - "지금 받기" → 앱이 APK 를 직접 받아 안드로이드 설치 화면을 띄움 (마지막 "설치" 는 사용자가 직접 눌러야 함: 안드로이드 규칙)
 * - 데이터는 서버·휴대폰에 그대로라 다시 설치해도 그대로임
 */
class Updater {
    static final String BASE = "https://github.com/woori-001/Mallang/releases/download/android-test/";
    static final String PREFS = "mallang_update";
    private final Activity act;
    private boolean waitPermission;
    private AlertDialog progress;

    Updater(Activity a) { act = a; }

    /** 앱을 열 때마다 (30분에 한 번만) 새 버전 확인 */
    void check(boolean force) {
        SharedPreferences p = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong("checked", 0) < 30 * 60_000L) return;
        p.edit().putLong("checked", now).apply();
        new Thread(() -> {
            try {
                JSONObject j = new JSONObject(new String(fetch(BASE + "android-version.json", null), "UTF-8"));
                int code = j.optInt("code", 0);
                String src = j.optString("src", "");
                if (code <= BuildConfig.VERSION_CODE || src.equals(BuildConfig.SRC_HASH)) return;   // 이미 최신 (웹앱만 바뀐 빌드도 여기서 걸러짐)
                if (!force && p.getInt("skip", 0) == code && now - p.getLong("skipAt", 0) < 24 * 3600_000L) return;   // "나중에" 누른 버전은 하루 동안 안 물어봄
                act.runOnUiThread(() -> ask(code));
            } catch (Exception e) { /* 인터넷이 없거나 실패하면 조용히 넘어감 */ }
        }).start();
    }

    void ask(int code) {
        if (act.isFinishing()) return;
        new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle("새 버전이 있어요 🐰")
            .setMessage("위젯이 새로 바뀌었어요. 지금 받아서 설치할까요?\n\n메모·일정은 그대로예요. 마지막에 뜨는 화면에서 '업데이트(설치)'만 눌러 주세요.")
            .setPositiveButton("지금 받기", (d, w) -> start())
            .setNegativeButton("나중에", (d, w) -> act.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt("skip", code).putLong("skipAt", System.currentTimeMillis()).apply())
            .show();
    }

    /** 설치 허락(출처를 알 수 없는 앱 설치)이 없으면 설정 화면부터 */
    void start() {
        if (!act.getPackageManager().canRequestPackageInstalls()) {
            waitPermission = true;
            Toast.makeText(act, "'이 출처 허용'을 켜고 뒤로 돌아와 주세요", Toast.LENGTH_LONG).show();
            try { act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName()))); } catch (Exception e) { /* 무시 */ }
            return;
        }
        download();
    }

    /** 설정에서 허락하고 돌아왔을 때 이어서 */
    void onResume() {
        if (waitPermission && act.getPackageManager().canRequestPackageInstalls()) { waitPermission = false; download(); }
    }

    private void download() {
        progress = new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle("새 버전 받는 중").setMessage("0%").setCancelable(false).show();
        new Thread(() -> {
            try {
                byte[] apk = fetch(BASE + "MallangMemo-android-test.apk", pct -> act.runOnUiThread(() -> { if (progress != null) progress.setMessage(pct + "%"); }));
                PackageInstaller pi = act.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(act.getPackageName());
                int sid = pi.createSession(sp);
                try (PackageInstaller.Session s = pi.openSession(sid)) {
                    try (OutputStream out = s.openWrite("mallang.apk", 0, apk.length)) { out.write(apk); s.fsync(out); }
                    int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    PendingIntent cb = PendingIntent.getBroadcast(act, sid, new Intent(act, InstallResult.class), fl);
                    s.commit(cb.getIntentSender());
                }
                act.runOnUiThread(() -> { if (progress != null) progress.dismiss(); });
            } catch (Exception e) {
                act.runOnUiThread(() -> {
                    if (progress != null) progress.dismiss();
                    Toast.makeText(act, "받지 못했어요. 인터넷을 확인하고 다시 해 주세요", Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    interface Progress { void on(int pct); }

    /** 깃허브 다운로드 (다른 주소로 넘겨주면 따라감) */
    static byte[] fetch(String url, Progress pr) throws Exception {
        for (int hop = 0; hop < 5; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(10000); c.setReadTimeout(30000);
            c.setRequestProperty("Cache-Control", "no-cache");
            int st = c.getResponseCode();
            if (st >= 300 && st < 400) { url = new URL(new URL(url), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (st != 200) throw new Exception("HTTP " + st);
            long len = c.getContentLengthLong();
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream bo = new ByteArrayOutputStream()) {
                byte[] buf = new byte[32768]; int n; long got = 0; int last = -1;
                while ((n = in.read(buf)) > 0) {
                    bo.write(buf, 0, n); got += n;
                    if (pr != null && len > 0) { int pct = (int) (got * 100 / len); if (pct != last) { last = pct; pr.on(pct); } }
                }
                return bo.toByteArray();
            }
        }
        throw new Exception("too many redirects");
    }
}
