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
            off = Math.max(-1, Math.min(3, off));   // 웹앱이 넘겨주는 범위: 지난달 ~ 석 달 뒤
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
        mgr.updateAppWidget(wid, build(ctx, p.getString("data", "{}"), p.getInt("off", 0), hDp > 0 ? hDp : 380));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int wid, android.os.Bundle opts) {
        draw(ctx, mgr, wid);   // 위젯 크기를 바꾸면 다시 그림
    }

    /** 위젯 화면 만들기 (홈 화면 위젯과 미리보기 화면이 같이 씀) */
    static RemoteViews build(Context ctx, String json, int off, int hDp) {
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
        int alpha = Math.max(0, Math.min(100, data.optInt("alpha", 100)));   // 앱 설정 > 위젯 투명도
        v.setInt(R.id.bg, "setImageAlpha", Math.round(alpha * 255f / 100f));

        Calendar today = Calendar.getInstance();
        String todayK = key(today);
        Calendar m = Calendar.getInstance();
        m.set(Calendar.DAY_OF_MONTH, 1);
        m.add(Calendar.MONTH, off);
        int y = m.get(Calendar.YEAR), mo = m.get(Calendar.MONTH);

        v.setTextViewText(R.id.mnum, String.valueOf(mo + 1));
        v.setTextColor(R.id.mnum, acc);
        v.setTextViewText(R.id.men, MONTH_EN[mo] + " " + y);
        v.setTextColor(R.id.men, acc);
        for (int id : new int[] { R.id.today, R.id.prev, R.id.next }) v.setTextColor(id, ink);
        v.setViewVisibility(R.id.today, off == 0 ? View.GONE : View.VISIBLE);
        int[] wds = { R.id.w0, R.id.w1, R.id.w2, R.id.w3, R.id.w4, R.id.w5, R.id.w6 };
        for (int i = 0; i < 7; i++) v.setTextColor(wds[i], i == 0 ? sun : i == 6 ? sat : sub);

        int start = m.get(Calendar.DAY_OF_WEEK) - 1;
        int n = m.getActualMaximum(Calendar.DAY_OF_MONTH);
        int rows = (start + n + 6) / 7;
        String pkg = ctx.getPackageName();
        for (int r = 0; r < 6; r++) v.setViewVisibility(ctx.getResources().getIdentifier("r" + r, "id", pkg), r < rows ? View.VISIBLE : View.GONE);
        // 칸 하나에 들어갈 일정 줄 수: 위젯 높이에서 머리·요일 줄을 빼고 줄 수로 나눔 (숫자 22dp, 일정 한 줄 14dp)
        int rowH = (hDp - 72) / rows;
        int slots = Math.max(0, Math.min(3, (rowH - 23) / 14));
        android.content.res.Resources res = ctx.getResources();
        for (int i = 0; i < 42; i++) {
            int nid = res.getIdentifier("n" + i, "id", pkg), tid = res.getIdentifier("t" + i, "id", pkg);
            int hid = res.getIdentifier("h" + i, "id", pkg), mid = res.getIdentifier("m" + i, "id", pkg), cid = res.getIdentifier("c" + i, "id", pkg);
            int[] chips = { res.getIdentifier("a" + i, "id", pkg), res.getIdentifier("b" + i, "id", pkg), res.getIdentifier("x" + i, "id", pkg) };
            for (int ch : chips) v.setViewVisibility(ch, View.GONE);
            int gid = res.getIdentifier("g" + i, "id", pkg), pid = res.getIdentifier("p" + i, "id", pkg), sid = res.getIdentifier("s" + i, "id", pkg);
            v.setViewVisibility(gid, View.GONE);
            v.setViewVisibility(pid, View.GONE);
            v.setViewVisibility(sid, View.GONE);
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
                try { v.setInt(gid, "setColorFilter", Color.parseColor(dbg)); v.setViewVisibility(gid, View.VISIBLE); } catch (Exception x) { /* 잘못된 색은 무시 */ }
            }
            String stk = info != null ? info.optString("s", "") : "";
            if (stk.length() > 0) { v.setTextViewText(sid, stk); v.setViewVisibility(sid, View.VISIBLE); }
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
                    room--;
                }
                if (hn.length() > 0 && room > 0) {
                    // 공휴일 이름을 칸에 바로 (예: 크리스마스)
                    v.setViewVisibility(hid, View.VISIBLE);
                    v.setTextViewText(hid, hn);
                    v.setTextColor(hid, sun);
                    room--;
                }
                // 일정 이름 (칸에 다 안 들어가면 마지막 줄은 +N)
                int showN = evn <= room ? evn : Math.max(0, room - 1);
                for (int j = 0; j < showN; j++) {
                    JSONObject e = ev.optJSONObject(j);
                    if (e == null) continue;
                    int dc; try { dc = Color.parseColor(e.optString("c", "#7466E4")); } catch (Exception x) { dc = acc; }
                    v.setViewVisibility(chips[j], View.VISIBLE);
                    v.setTextViewText(chips[j], e.optString("n", ""));
                    if (Build.VERSION.SDK_INT >= 31) {
                        v.setColorStateList(chips[j], "setBackgroundTintList", ColorStateList.valueOf(dc));
                        v.setTextColor(chips[j], Color.WHITE);
                    } else {
                        v.setInt(chips[j], "setBackgroundColor", (dc & 0x00FFFFFF) | 0x33000000);
                        v.setTextColor(chips[j], ink);
                    }
                }
                if (evn > showN) {
                    if (showN == 0 && room == 0) { if (dots.length() > 0) v.setViewVisibility(tid, View.VISIBLE); }
                    else {
                        v.setViewVisibility(mid, View.VISIBLE);
                        v.setTextViewText(mid, "+" + (evn - showN));
                        v.setTextColor(mid, sub);
                    }
                }
            }
            v.setOnClickPendingIntent(cid, openApp(ctx, k, 100 + i));   // 그 날짜로 앱 열기
        }

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
