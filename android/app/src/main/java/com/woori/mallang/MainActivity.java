package com.woori.mallang;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 말랑메모 안드로이드 앱 (테스트): 모바일 웹앱을 그대로 띄우고, 홈 화면 달력 위젯에 일정 요약을 넘겨받는 다리만 붙임.
 * 화면·기능은 웹앱(https://woori-001.github.io/Mallang/)이 그대로라서, 웹앱이 업데이트되면 앱도 바로 바뀜.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://woori-001.github.io/Mallang/";
    static final String HOST = "woori-001.github.io";
    private WebView web;
    private boolean loaded;
    private Updater updater;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " MallangAndroid/1");

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) { loaded = true; }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                // 말랑메모 화면만 앱 안에서, 나머지 링크는 휴대폰 브라우저로
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/Mallang")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* 열 앱이 없으면 무시 */ }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(this), "MallangAndroid");

        updater = new Updater(this);
        if (getIntent().getBooleanExtra("testUpdate", false)) updater.ask(0);   // 확인용: 새 버전 알림 창 모습

        String d = dateOf(getIntent());
        if (d != null) web.loadUrl(HOME + "#date=" + d);   // 위젯에서 누른 날짜로 시작
        else if (saved != null) web.restoreState(saved);
        else web.loadUrl(HOME);
    }

    /** 위젯에서 누른 날짜 (YYYY-MM-DD 만 받음) */
    static String dateOf(Intent i) {
        String d = i != null ? i.getStringExtra("date") : null;
        return d != null && d.matches("\\d{4}-\\d{2}-\\d{2}") ? d : null;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String d = dateOf(i);
        if (d == null) return;
        if (loaded) web.evaluateJavascript("window.mallangOpenDate&&mallangOpenDate('" + d + "')", null);
        else web.loadUrl(HOME + "#date=" + d);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updater.onResume();
        updater.check(false);   // 새 버전 확인 (30분에 한 번)
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** 휴대폰 캘린더 읽기 허락 요청 → 결과를 웹앱에 알려줌 */
    void askCalendar() {
        if (checkSelfPermission(android.Manifest.permission.READ_CALENDAR) == android.content.pm.PackageManager.PERMISSION_GRANTED) { calResult(true); return; }
        requestPermissions(new String[] { android.Manifest.permission.READ_CALENDAR }, 7);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == 7) calResult(res.length > 0 && res[0] == android.content.pm.PackageManager.PERMISSION_GRANTED);
    }

    void calResult(boolean ok) { web.evaluateJavascript("window.mallangCalPerm&&mallangCalPerm(" + ok + ")", null); }

    /** 웹앱 → 위젯: 일정 요약(JSON)을 휴대폰 안에만 저장하고 위젯을 다시 그림 */
    static class Bridge {
        private final Context ctx;
        private final MainActivity act;
        Bridge(MainActivity a) { act = a; ctx = a.getApplicationContext(); }

        /** 휴대폰 캘린더: 허락 요청 (결과는 window.mallangCalPerm(true/false) 로) */
        @JavascriptInterface
        public void askCalendar() { act.runOnUiThread(act::askCalendar); }

        /** 휴대폰 캘린더 목록 (JSON) */
        @JavascriptInterface
        public String calendars() { return PhoneCalendar.calendars(ctx); }

        /** 휴대폰 캘린더 일정 (반복 일정은 날짜마다 펼쳐서, JSON) */
        @JavascriptInterface
        public String calendarEvents(String ids, double from, double to) { return PhoneCalendar.events(ctx, ids, (long) from, (long) to); }

        @JavascriptInterface
        public void saveWidget(String json) {
            if (json == null || json.length() > 1500000) return;
            ctx.getSharedPreferences(CalendarWidget.PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply();
            CalendarWidget.refreshAll(ctx);
        }

        @JavascriptInterface
        public int version() { return 1; }
    }
}
