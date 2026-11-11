package com.woori.mallang;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * 말랑메모 홈 화면 달력 위젯.
 * 웹앱이 넘겨준 요약(prefs "data")으로 이번 달 칸·일정 점·오늘 일정을 그림. ‹ › 로 달 넘기기, 오늘로 돌아오기, 누르면 앱 열기.
 */
public class CalendarWidget extends AppWidgetProvider {
    static final String PREFS = "mallang_widget";
    static final String ACT_PREV = "com.woori.mallang.WIDGET_PREV";
    static final String ACT_NEXT = "com.woori.mallang.WIDGET_NEXT";
    static final String ACT_TODAY = "com.woori.mallang.WIDGET_TODAY";
    static final String[] MONTH_EN = { "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER" };
    static final String[] WD = { "일", "월", "화", "수", "목", "금", "토" };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) draw(ctx, mgr, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (ACT_PREV.equals(a) || ACT_NEXT.equals(a) || ACT_TODAY.equals(a)) {
            SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            int off = ACT_TODAY.equals(a) ? 0 : p.getInt("off", 0) + (ACT_NEXT.equals(a) ? 1 : -1);
            off = Math.max(-12, Math.min(36, off));   // 웹앱이 넘겨주는 범위: 1년 전 ~ 3년 뒤
            p.edit().putInt("off", off).apply();
            refreshAll(ctx);
            return;
        }
        super.onReceive(ctx, intent);
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, CalendarWidget.class));
        for (int id : ids) draw(ctx, mgr, id);
    }

    static int col(JSONObject o, String k, String d) {
        try { return Color.parseColor(o != null ? o.optString(k, d) : d); } catch (Exception e) { return Color.parseColor(d); }
    }

    static String key(Calendar c) {
        return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static PendingIntent bcast(Context ctx, String act, int req) {
        Intent i = new Intent(ctx, CalendarWidget.class).setAction(act);
        return PendingIntent.getBroadcast(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 앱 열기 (date 가 있으면 그 날짜 달력으로). 날짜마다 다른 data 를 붙여야 PendingIntent 가 섞이지 않음 */
    static PendingIntent openApp(Context ctx, String date, int req) {
        Intent i = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (date != null) i.setAction("com.woori.mallang.OPEN_DATE").setData(android.net.Uri.parse("mallang://date/" + date)).putExtra("date", date);
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void draw(Context ctx, AppWidgetManager mgr, int wid) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        android.os.Bundle o = mgr.getAppWidgetOptions(wid);
        int hDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        int wDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
        mgr.updateAppWidget(wid, build(ctx, p.getString("data", "{}"), p.getInt("off", 0), wDp > 0 ? wDp : 330, hDp > 0 ? hDp : 380));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int wid, android.os.Bundle opts) {
        draw(ctx, mgr, wid);   // 위젯 크기를 바꾸면 다시 그림
    }

    /** 위젯 화면 만들기 (홈 화면 위젯과 미리보기 화면이 같이 씀) */
    /** 앱이 그려 보낸 그림 (data:image/png;base64,...) → 비트맵 */
    static android.graphics.Bitmap img(String dataUrl) {
        if (dataUrl == null || dataUrl.length() < 30) return null;
        try {
            byte[] b = android.util.Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), android.util.Base64.DEFAULT);
            return android.graphics.BitmapFactory.decodeByteArray(b, 0, b.length);
        } catch (Exception e) { return null; }
    }

    static int argb(JSONArray a, int def) {
        if (a == null || a.length() < 3) return def;
        int al = (int) Math.round(Math.max(0, Math.min(1, a.optDouble(3, 1))) * 255);
        return Color.argb(al, a.optInt(0), a.optInt(1), a.optInt(2));
    }

    /** 앱 달력 카드 그대로: 스킨 바탕 + 몽글몽글 색 번짐 4개 + 카드 색(유리는 반투명) + 종이 스킨 테두리
     *  (번짐이라 작게 그려 늘려도 티가 안 나서 절반 크기로 그림) */
    static android.graphics.Bitmap drawBg(JSONObject art, int wDp, int hDp) {
        try {
            float k = 0.35f;   // 위젯이 한 번에 받을 수 있는 그림 양이 정해져 있어서 배경은 작게 (번짐이라 티 안 남)
            int W = Math.max(60, Math.round(wDp * k)), H = Math.max(60, Math.round(hDp * k));
            android.graphics.Bitmap bm = android.graphics.Bitmap.createBitmap(W, H, android.graphics.Bitmap.Config.ARGB_8888);
            android.graphics.Canvas c = new android.graphics.Canvas(bm);
            c.drawColor(argb(art.optJSONArray("base"), Color.parseColor("#EEF0FB")) | 0xFF000000);
            JSONArray b = art.optJSONArray("b");
            boolean dark = art.optBoolean("dark", false);
            float[][] pos = { { 0.08f, 0.04f, 0.62f }, { 1.02f, 0.58f, 0.55f }, { 0.45f, 1.06f, 0.7f }, { 0.96f, -0.04f, 0.5f } };   // 앱 화면 번짐 자리 (가로 비율, 세로 비율, 반지름)
            if (b != null) for (int i = 0; i < Math.min(4, b.length()); i++) {
                int col = Color.parseColor(b.optString(i, "#FFCADB"));
                float cx = pos[i][0] * W, cy = pos[i][1] * H, r = pos[i][2] * Math.max(W, H);
                int a0 = dark ? 140 : 225;
                android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
                p.setShader(new android.graphics.RadialGradient(cx, cy, r,
                    new int[] { (col & 0x00FFFFFF) | (a0 << 24), (col & 0x00FFFFFF) | ((a0 / 2) << 24), col & 0x00FFFFFF },
                    new float[] { 0f, 0.5f, 1f }, android.graphics.Shader.TileMode.CLAMP));
                c.drawCircle(cx, cy, r, p);
            }
            c.drawColor(argb(art.optJSONArray("card"), Color.argb(150, 255, 255, 255)));
            // 테두리는 그리지 않음: 작게 그린 배경을 늘리면 선이 두껍고 흐려져서 지저분해 보임
            return bm;
        } catch (Exception e) { return null; }
    }

    static RemoteViews build(Context ctx, String json, int off, int wDp, int hDp) {
        boolean compact = hDp < 330;
        JSONObject data = null;
        try { data = new JSONObject(json); } catch (Exception e) { data = new JSONObject(); }
        JSONObject skin = data.optJSONObject("skin");
        JSONObject days = data.optJSONObject("days");
        JSONObject list = data.optJSONObject("list");
        JSONArray tapes = data.optJSONArray("tapes");   // 마스킹테이프 [{ s, e, t, c }]

        int bg = col(skin, "bg", "#F4F1FA"), ink = col(skin, "ink", "#4A3F6B"), sub = col(skin, "sub", "#8A80A8");
        int acc = col(skin, "a1", "#7466E4"), sun = col(skin, "sun", "#E0708A"), sat = col(skin, "sat", "#5B8DD6");

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_calendar);
        v.setInt(R.id.bg, "setColorFilter", bg);
        // 스킨 꾸밈: 앱과 같은 바탕(색 번짐)·같은 글꼴로 쓴 달 제목과 로고·요일
        JSONObject art = data.optJSONObject("art");
        int[] wdCol = { sun, ink, ink, ink, ink, ink, sat };
        boolean darkSkin = art != null && art.optBoolean("dark", false);   // 갤럭시 캘린더처럼 평일 요일은 진하게
        boolean artHead = false, artWd = false;
        if (art != null) {
            android.graphics.Bitmap bgb = drawBg(art, wDp, hDp);
            if (bgb != null) { v.setImageViewBitmap(R.id.bg, bgb); v.setInt(R.id.bg, "setColorFilter", 0); }
            // 요일 줄 바탕 (앱에서 요일 줄에 바탕색이 있는 스킨만, 예: 드로잉 스킨의 까만 줄)
            int wdBg = argb(art.optJSONArray("wdBg"), 0);
            if (Color.alpha(wdBg) > 10 && Build.VERSION.SDK_INT >= 31) {
                v.setInt(R.id.wrow, "setBackgroundResource", R.drawable.pill);
                v.setColorStateList(R.id.wrow, "setBackgroundTintList", ColorStateList.valueOf(wdBg));
            } else v.setInt(R.id.wrow, "setBackgroundResource", 0);   // 위젯은 화면을 다시 쓰지 않고 고칠 것만 덧칠하므로, 드로잉 스킨에서 바꾸면 까만 줄을 꼭 지워야 함
            // 말랑 로고 스티커 (달 이름 옆)
            android.graphics.Bitmap lb = img(art.optString("logo", ""));
            if (lb != null) { v.setImageViewBitmap(R.id.mimg, lb); artHead = true; }
            // 요일 글자색: 앱 요일 줄 색 그대로
            JSONArray wc = art.optJSONArray("wdc");
            // 요일 줄 바탕이 있는 스킨(드로잉)만 앱 요일 글자색 그대로 (까만 바탕에 흰 글자)
            if (wc != null && wc.length() == 7 && Color.alpha(argb(art.optJSONArray("wdBg"), 0)) > 10) for (int i = 0; i < 7; i++) wdCol[i] = argb(wc.optJSONArray(i), wdCol[i]) | 0xFF000000;
        }
        v.setViewVisibility(R.id.mimg, artHead ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.men, View.GONE);
        for (int i = 0; i < 7; i++) {
            v.setViewVisibility(ctx.getResources().getIdentifier("wi" + i, "id", ctx.getPackageName()), View.GONE);
            v.setViewVisibility(ctx.getResources().getIdentifier("w" + i, "id", ctx.getPackageName()), View.VISIBLE);
        }
        int alpha = Math.max(0, Math.min(100, data.optInt("alpha", 100)));   // 앱 설정 > 위젯 투명도
        v.setInt(R.id.bg, "setImageAlpha", Math.round(alpha * 255f / 100f));

        Calendar today = Calendar.getInstance();
        String todayK = key(today);
        Calendar m = Calendar.getInstance();
        m.set(Calendar.DAY_OF_MONTH, 1);
        m.add(Calendar.MONTH, off);
        int y = m.get(Calendar.YEAR), mo = m.get(Calendar.MONTH);

        // 갤럭시 캘린더처럼 "11월" (해가 다르면 "2027년 1월")
        v.setTextViewText(R.id.mnum, (y != today.get(Calendar.YEAR) ? y + "년 " : "") + (mo + 1) + "월");
        v.setTextColor(R.id.mnum, ink);
        v.setTextViewText(R.id.men, MONTH_EN[mo] + " " + y);
        v.setTextColor(R.id.men, acc);
        // 갤럭시 캘린더처럼: ‹ 달 › 를 왼쪽에 모으고, 오른쪽엔 오늘 날짜가 든 네모 (누르면 오늘로)
        v.setTextColor(R.id.today, ink);
        v.setInt(R.id.prev, "setColorFilter", ink); v.setInt(R.id.next, "setColorFilter", ink);
        v.setTextViewText(R.id.today, String.valueOf(today.get(Calendar.DAY_OF_MONTH)));
        if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(R.id.today, "setBackgroundTintList", ColorStateList.valueOf(ink));
        int[] wds = { R.id.w0, R.id.w1, R.id.w2, R.id.w3, R.id.w4, R.id.w5, R.id.w6 };
        for (int i = 0; i < 7; i++) v.setTextColor(wds[i], wdCol[i]);

        int start = m.get(Calendar.DAY_OF_WEEK) - 1;
        int n = m.getActualMaximum(Calendar.DAY_OF_MONTH);
        int rows = (start + n + 6) / 7;
        String pkg = ctx.getPackageName();
        // 주마다 구분선 (드로잉 스킨은 펜으로 그은 듯 진하게)
        boolean drawSkin = art != null && "draw".equals(art.optString("skin"));
        int lineC = (ink & 0x00FFFFFF) | (drawSkin ? 0x99000000 : 0x1F000000);
        for (int r = 0; r < 6; r++) {
            v.setViewVisibility(ctx.getResources().getIdentifier("r" + r, "id", pkg), r < rows ? View.VISIBLE : View.GONE);
            int did = ctx.getResources().getIdentifier("d" + r, "id", pkg);
            v.setViewVisibility(did, r < rows ? View.VISIBLE : View.GONE);
            v.setInt(did, "setBackgroundColor", lineC);
            if (Build.VERSION.SDK_INT >= 31) v.setViewLayoutHeight(did, drawSkin ? 1.6f : 1f, android.util.TypedValue.COMPLEX_UNIT_DIP);
        }
        // 칸 하나에 들어갈 일정 줄 수: 위젯 높이에서 머리·요일 줄을 빼고 줄 수로 나눔 (숫자 22dp, 일정 한 줄 14dp)
        // 위젯이 크면 글자·일정·스티커도 같이 크게 (안드로이드 12 이상: 칸 크기를 바꿀 수 있음)
        boolean big = Build.VERSION.SDK_INT >= 31;
        float cellW = (wDp - 20) / 7f;
        // 크기 비율은 갤럭시 기본 캘린더 기준 (칸 너비 54dp 일 때 날짜 15sp · 일정 11sp)
        float sc = big ? Math.max(0.8f, Math.min(1.3f, Math.min(cellW / 54f, ((hDp - 90f) / rows) / 70f))) : 1f;
        float sh = big ? Math.max(0.9f, Math.min(1.2f, wDp / 360f)) : 1f;
        final int DIP = android.util.TypedValue.COMPLEX_UNIT_DIP, SP = android.util.TypedValue.COMPLEX_UNIT_SP;
        float numBox = big ? 27 * sc : 22, chipH = big ? 17 * sc : 14, tapeH = big ? 16 * sc : 13;
        if (big) {
            v.setViewLayoutHeight(R.id.mimg, 32 * sh, DIP);
            v.setTextViewTextSize(R.id.mnum, SP, 17 * sh);   // 갤럭시 캘린더: 달 이름은 날짜보다 조금만 크게
            for (int i = 0; i < 7; i++) v.setTextViewTextSize(ctx.getResources().getIdentifier("w" + i, "id", ctx.getPackageName()), SP, 14.5f * sc);
        }
        float rowH = (hDp - 20 - 42 * sh - 26 * sc) / rows;
        int slots = Math.max(0, Math.min(5, (int) ((rowH - numBox - 3) / (chipH + 1))));
        android.content.res.Resources res = ctx.getResources();
        // 스티커 그림 (같은 스티커는 그림 하나를 같이 씀)
        JSONObject stkArt = art != null ? art.optJSONObject("stk") : null;
        java.util.HashMap<String, android.graphics.Bitmap> stkBm = new java.util.HashMap<>();
        for (int i = 0; i < 42; i++) {
            int nid = res.getIdentifier("n" + i, "id", pkg), tid = res.getIdentifier("t" + i, "id", pkg);
            int hid = res.getIdentifier("h" + i, "id", pkg), mid = res.getIdentifier("m" + i, "id", pkg), cid = res.getIdentifier("c" + i, "id", pkg);
            int[] chips = { res.getIdentifier("a" + i, "id", pkg), res.getIdentifier("b" + i, "id", pkg), res.getIdentifier("x" + i, "id", pkg) };
            for (int ch : chips) v.setViewVisibility(ch, View.GONE);
            v.setViewVisibility(res.getIdentifier("o" + i, "id", pkg), View.GONE);
            if (big) {
                v.setTextViewTextSize(nid, SP, 15f * sc);
                v.setViewLayoutWidth(nid, numBox, DIP); v.setViewLayoutHeight(nid, numBox, DIP);
                for (int ch : chips) { v.setTextViewTextSize(ch, SP, 11f * sc); v.setViewLayoutHeight(ch, chipH, DIP); }
                int pid0 = res.getIdentifier("p" + i, "id", pkg), sid0 = res.getIdentifier("s" + i, "id", pkg);
                v.setTextViewTextSize(pid0, SP, 10.5f * sc); v.setViewLayoutHeight(pid0, tapeH, DIP);
                v.setTextViewTextSize(res.getIdentifier("h" + i, "id", pkg), SP, 10.5f * sc);
                v.setTextViewTextSize(res.getIdentifier("m" + i, "id", pkg), SP, 10.5f * sc);
                v.setViewLayoutWidth(sid0, 19 * sc, DIP); v.setViewLayoutHeight(sid0, 19 * sc, DIP);   // 날짜 숫자를 가리지 않게 칸 모서리에
            }
            int gid = res.getIdentifier("g" + i, "id", pkg), pid = res.getIdentifier("p" + i, "id", pkg), sid = res.getIdentifier("s" + i, "id", pkg);
            v.setViewVisibility(gid, View.GONE);
            v.setViewVisibility(pid, View.GONE);
            v.setViewVisibility(sid, View.GONE);
            int kid = res.getIdentifier("k" + i, "id", pkg);
            v.setViewVisibility(kid, View.GONE);
            v.setViewVisibility(hid, View.GONE);
            v.setViewVisibility(mid, View.GONE);
            v.setViewVisibility(tid, View.GONE);
            int d = i - start + 1;
            if (d < 1 || d > n) { v.setTextViewText(nid, ""); v.setInt(nid, "setBackgroundResource", 0); v.setOnClickPendingIntent(cid, openApp(ctx, null, 0)); continue; }
            Calendar c = (Calendar) m.clone();
            c.set(Calendar.DAY_OF_MONTH, d);
            String k = key(c);
            JSONObject info = days != null ? days.optJSONObject(k) : null;
            boolean hol = info != null && info.optString("h", "").length() > 0;
            int wd = i % 7;
            int color = wd == 0 || hol ? sun : wd == 6 ? sat : ink;
            boolean isToday = k.equals(todayK);
            v.setTextViewText(nid, String.valueOf(d));
            // 오늘 칸은 칸 전체를 둥근 테두리로 (갤럭시 캘린더처럼)
            int oid = res.getIdentifier("o" + i, "id", pkg);
            v.setViewVisibility(oid, isToday ? View.VISIBLE : View.GONE);
            if (isToday) v.setInt(oid, "setColorFilter", (acc & 0x00FFFFFF) | 0xB3000000);
            if (isToday) {
                v.setInt(nid, "setBackgroundResource", R.drawable.today);
                if (Build.VERSION.SDK_INT >= 31) {
                    v.setColorStateList(nid, "setBackgroundTintList", ColorStateList.valueOf(acc));
                    v.setTextColor(nid, Color.WHITE);
                } else v.setTextColor(nid, acc);
            } else {
                v.setInt(nid, "setBackgroundResource", 0);
                v.setTextColor(nid, color);
            }
            // 일정 점 (최대 3개, 일정 색 그대로)
            SpannableStringBuilder dots = new SpannableStringBuilder();
            JSONArray cs = info != null ? info.optJSONArray("c") : null;
            if (cs != null) for (int j = 0; j < Math.min(3, cs.length()); j++) {
                int s0 = dots.length();
                dots.append("●");
                int dc; try { dc = Color.parseColor(cs.optString(j, "#7466E4")); } catch (Exception e) { dc = acc; }
                dots.setSpan(new ForegroundColorSpan(dc), s0, dots.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            v.setTextViewText(tid, dots);
            // 날짜 배경색 · 스티커 (앱 달력에서 붙인 것)
            String dbg = info != null ? info.optString("bg", "") : "";
            if (dbg.length() > 0) {
                try {
                    v.setInt(gid, "setColorFilter", Color.parseColor(dbg));
                    v.setInt(gid, "setImageAlpha", darkSkin ? 80 : 255);   // 어두운 스킨: 밝은 배경색이면 흰 숫자가 안 보여서 옅게
                    v.setViewVisibility(gid, View.VISIBLE);
                } catch (Exception x) { /* 잘못된 색은 무시 */ }
            }
            String stk = info != null ? info.optString("s", "") : "";
            android.graphics.Bitmap sb = null;
            if (stk.length() > 0 && stkArt != null) {
                sb = stkBm.get(stk);
                if (sb == null && !stkBm.containsKey(stk)) { sb = img(stkArt.optString(stk, "")); stkBm.put(stk, sb); }
            }
            int lines = 0;   // 날짜 아래에 쓴 줄 수 (스티커 자리 계산용)
            String hn = info != null ? info.optString("h", "") : "";
            JSONArray ev = list != null ? list.optJSONArray(k) : null;
            int evn = ev != null ? ev.length() : 0;
            if (compact) {
                // 작은 위젯: 점만
                if (dots.length() > 0) v.setViewVisibility(tid, View.VISIBLE);
            } else {
                int room = slots;
                // 마스킹테이프 (이 날에 걸친 첫 번째 것) — 칸마다 이어 붙여 그리고, 이름은 시작한 날·일요일 칸에만
                JSONObject tp = null;
                if (tapes != null) for (int j = 0; j < tapes.length(); j++) {
                    JSONObject x = tapes.optJSONObject(j);
                    if (x != null && x.optString("s").compareTo(k) <= 0 && x.optString("e").compareTo(k) >= 0) { tp = x; break; }
                }
                if (tp != null && room > 0) {
                    int tc; try { tc = Color.parseColor(tp.optString("c", "#FFC0A3")); } catch (Exception x) { tc = Color.parseColor("#FFC0A3"); }
                    v.setViewVisibility(pid, View.VISIBLE);
                    v.setInt(pid, "setBackgroundColor", tc);
                    v.setTextViewText(pid, k.equals(tp.optString("s")) || wd == 0 || d == 1 ? tp.optString("t", "") : "");
                    room--; lines++;
                }
                if (hn.length() > 0 && room > 0) {
                    // 공휴일 이름을 칸에 바로 (예: 크리스마스)
                    v.setViewVisibility(hid, View.VISIBLE);
                    v.setTextViewText(hid, hn);
                    v.setTextColor(hid, sun);
                    room--; lines++;
                }
                // 일정 이름 (칸에 다 안 들어가면 마지막 줄은 +N)
                int showN = Math.min(3, evn <= room ? evn : Math.max(0, room - 1));
                for (int j = 0; j < showN; j++) {
                    JSONObject e = ev.optJSONObject(j);
                    if (e == null) continue;
                    int dc; try { dc = Color.parseColor(e.optString("c", "#7466E4")); } catch (Exception x) { dc = acc; }
                    v.setViewVisibility(chips[j], View.VISIBLE);
                    v.setTextViewText(chips[j], e.optString("n", ""));
                    if (Build.VERSION.SDK_INT >= 31) {
                        // 갤럭시 캘린더처럼: 옅은 색 바탕 + 같은 계열 진한 글자
                        if (darkSkin) {
                            // 어두운 스킨(미드나잇): 조금 더 진한 색 바탕 + 밝은 글자 (진한 글자는 안 보임)
                            v.setColorStateList(chips[j], "setBackgroundTintList", ColorStateList.valueOf((dc & 0x00FFFFFF) | 0x66000000));
                            v.setTextColor(chips[j], Color.rgb(255 - (255 - Color.red(dc)) * 25 / 100, 255 - (255 - Color.green(dc)) * 25 / 100, 255 - (255 - Color.blue(dc)) * 25 / 100));
                        } else {
                            v.setColorStateList(chips[j], "setBackgroundTintList", ColorStateList.valueOf((dc & 0x00FFFFFF) | 0x38000000));
                            v.setTextColor(chips[j], Color.rgb(Color.red(dc) * 55 / 100, Color.green(dc) * 55 / 100, Color.blue(dc) * 55 / 100));
                        }
                    } else {
                        v.setInt(chips[j], "setBackgroundColor", (dc & 0x00FFFFFF) | 0x33000000);
                        v.setTextColor(chips[j], ink);
                    }
                }
                lines += showN;
                if (evn > showN) {
                    if (showN > 0 || room > 0) lines++;
                    if (showN == 0 && room == 0) { if (dots.length() > 0) v.setViewVisibility(tid, View.VISIBLE); }
                    else {
                        v.setViewVisibility(mid, View.VISIBLE);
                        v.setTextViewText(mid, "+" + (evn - showN));
                        v.setTextColor(mid, sub);
                    }
                }
            }
            // 스티커: 칸 아래에 남는 자리가 넉넉하면 크게 (예시 앱처럼), 아니면 칸 모서리에 작게
            if (sb != null) {
                float free = rowH - (numBox + 3) - lines * (chipH + 1) - 4;
                float size = Math.min(Math.min(cellW - 8, free), 58);
                if (big && !compact && size >= 24) {
                    v.setImageViewBitmap(kid, sb); v.setViewVisibility(kid, View.VISIBLE);
                    v.setViewLayoutWidth(kid, size, DIP); v.setViewLayoutHeight(kid, size, DIP);
                } else { v.setImageViewBitmap(sid, sb); v.setViewVisibility(sid, View.VISIBLE); }
            }
            v.setOnClickPendingIntent(cid, openApp(ctx, k, 100 + i));   // 그 날짜로 앱 열기
        }
        // 말랑이: 달 끝에 빈 칸이 2칸 이상 있으면 거기에 앉아 있음
        int trail = rows * 7 - (start + n);
        android.graphics.Bitmap bun = art != null && !compact && trail >= 2 ? img(art.optString("bunny", "")) : null;
        if (bun != null && (big || trail >= 3)) {
            v.setImageViewBitmap(R.id.bun, bun);
            v.setViewVisibility(R.id.bun, View.VISIBLE);
            if (big) {
                float ratio = bun.getWidth() / (float) bun.getHeight();
                float bh = Math.min(rowH * 0.82f, trail * cellW * 0.8f / ratio);
                v.setViewLayoutHeight(R.id.bun, bh, DIP);
                v.setViewLayoutWidth(R.id.bun, bh * ratio, DIP);
            }
        } else v.setViewVisibility(R.id.bun, View.GONE);

        // 아래: 오늘 일정 (오늘 칸이 보이는 달이면 오늘, 아니면 그 달 1일)
        Calendar show = off == 0 ? today : m;
        String sk = key(show);
        JSONObject sinfo = days != null ? days.optJSONObject(sk) : null;
        String head = (show.get(Calendar.MONTH) + 1) + "월 " + show.get(Calendar.DAY_OF_MONTH) + "일 " + WD[show.get(Calendar.DAY_OF_WEEK) - 1] + "요일"
            + (sinfo != null && sinfo.optString("h", "").length() > 0 ? " · " + sinfo.optString("h") : "");
        v.setTextViewText(R.id.ehead, head);
        v.setTextColor(R.id.ehead, sub);
        v.setInt(R.id.line, "setBackgroundColor", (sub & 0x00FFFFFF) | 0x33000000);
        JSONArray evs = list != null ? list.optJSONArray(sk) : null;
        int[] eids = { R.id.e0, R.id.e1, R.id.e2 };
        for (int id : new int[] { R.id.line, R.id.ehead, R.id.e0, R.id.e1, R.id.e2 }) v.setViewVisibility(id, compact ? View.VISIBLE : View.GONE);
        if (compact) {
            // 작은 위젯: 날짜 칸이 넉넉하도록 아래는 한 줄만 (예: 11월 11일 · 09:30 주간 회의 외 3개)
            v.setViewVisibility(R.id.ehead, View.GONE);
            v.setViewVisibility(R.id.e1, View.GONE);
            v.setViewVisibility(R.id.e2, View.GONE);
            v.setViewVisibility(R.id.e0, View.VISIBLE);
            SpannableStringBuilder t = new SpannableStringBuilder();
            t.append((show.get(Calendar.MONTH) + 1) + "/" + show.get(Calendar.DAY_OF_MONTH) + "  ");
            t.setSpan(new StyleSpan(Typeface.BOLD), 0, t.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            JSONObject e = evs != null && evs.length() > 0 ? evs.optJSONObject(0) : null;
            if (e == null) t.append(data.has("days") ? "일정이 없어요" : "앱을 한 번 열면 일정이 보여요");
            else {
                int s0 = t.length();
                t.append("● ");
                int dc; try { dc = Color.parseColor(e.optString("c", "#7466E4")); } catch (Exception x) { dc = acc; }
                t.setSpan(new ForegroundColorSpan(dc), s0, s0 + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                String tm = e.optString("t", "");
                t.append(tm.length() > 0 ? tm + " " : "").append(e.optString("n", ""));
                if (evs.length() > 1) t.append(" 외 " + (evs.length() - 1) + "개");
            }
            v.setTextViewText(R.id.e0, t);
            v.setTextColor(R.id.e0, e == null ? sub : ink);
        }

        // 누르기: 달 넘기기 / 오늘 / 그 외는 앱 열기
        v.setOnClickPendingIntent(R.id.prev, bcast(ctx, ACT_PREV, 1));
        v.setOnClickPendingIntent(R.id.next, bcast(ctx, ACT_NEXT, 2));
        v.setOnClickPendingIntent(R.id.today, bcast(ctx, ACT_TODAY, 3));
        // 달 이름을 누르면 그 달로 (이번 달이면 오늘), 빈 곳은 그냥 앱 열기
        v.setOnClickPendingIntent(R.id.mbox, openApp(ctx, off == 0 ? todayK : key(m), 99));
        v.setOnClickPendingIntent(R.id.root, openApp(ctx, off == 0 ? null : key(m), 98));
        return v;
    }
}
