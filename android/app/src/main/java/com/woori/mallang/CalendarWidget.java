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

    static void draw(Context ctx, AppWidgetManager mgr, int wid) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        android.os.Bundle o = mgr.getAppWidgetOptions(wid);
        int hDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        mgr.updateAppWidget(wid, build(ctx, p.getString("data", "{}"), p.getInt("off", 0), hDp > 0 && hDp < 330));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int wid, android.os.Bundle opts) {
        draw(ctx, mgr, wid);   // 위젯 크기를 바꾸면 다시 그림
    }

    /** 위젯 화면 만들기 (홈 화면 위젯과 미리보기 화면이 같이 씀) */
    static RemoteViews build(Context ctx, String json, int off, boolean compact) {
        JSONObject data = null;
        try { data = new JSONObject(json); } catch (Exception e) { data = new JSONObject(); }
        JSONObject skin = data.optJSONObject("skin");
        JSONObject days = data.optJSONObject("days");
        JSONObject list = data.optJSONObject("list");

        int bg = col(skin, "bg", "#F4F1FA"), ink = col(skin, "ink", "#4A3F6B"), sub = col(skin, "sub", "#8A80A8");
        int acc = col(skin, "a1", "#7466E4"), sun = col(skin, "sun", "#E0708A"), sat = col(skin, "sat", "#5B8DD6");

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_calendar);
        v.setInt(R.id.bg, "setColorFilter", bg);

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
        for (int i = 0; i < 42; i++) {
            int nid = ctx.getResources().getIdentifier("n" + i, "id", pkg), tid = ctx.getResources().getIdentifier("t" + i, "id", pkg);
            int d = i - start + 1;
            if (d < 1 || d > n) { v.setTextViewText(nid, ""); v.setTextViewText(tid, ""); v.setInt(nid, "setBackgroundResource", 0); continue; }
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
        } else for (int j = 0; j < 3; j++) {
            JSONObject e = evs != null && j < evs.length() ? evs.optJSONObject(j) : null;
            if (e == null) {
                if (j == 0) {
                    v.setViewVisibility(eids[0], View.VISIBLE);
                    v.setTextViewText(eids[0], data.has("days") ? "일정이 없어요" : "말랑메모 앱을 한 번 열면 일정이 보여요");
                    v.setTextColor(eids[0], sub);
                } else v.setViewVisibility(eids[j], View.GONE);
                continue;
            }
            if (j == 2 && evs.length() > 3) {
                v.setViewVisibility(eids[2], View.VISIBLE);
                v.setTextViewText(eids[2], "외 " + (evs.length() - 2) + "개");
                v.setTextColor(eids[2], sub);
                continue;
            }
            SpannableStringBuilder t = new SpannableStringBuilder();
            t.append("● ");
            int dc; try { dc = Color.parseColor(e.optString("c", "#7466E4")); } catch (Exception x) { dc = acc; }
            t.setSpan(new ForegroundColorSpan(dc), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            String tm = e.optString("t", "");
            int s0 = t.length();
            t.append(tm.length() > 0 ? tm : "종일");
            t.setSpan(new StyleSpan(Typeface.BOLD), s0, t.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            t.append("  ").append(e.optString("n", ""));
            v.setViewVisibility(eids[j], View.VISIBLE);
            v.setTextViewText(eids[j], t);
            v.setTextColor(eids[j], ink);
        }

        // 누르기: 달 넘기기 / 오늘 / 그 외는 앱 열기
        v.setOnClickPendingIntent(R.id.prev, bcast(ctx, ACT_PREV, 1));
        v.setOnClickPendingIntent(R.id.next, bcast(ctx, ACT_NEXT, 2));
        v.setOnClickPendingIntent(R.id.today, bcast(ctx, ACT_TODAY, 3));
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent po = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.gridbox, po);
        v.setOnClickPendingIntent(R.id.root, po);
        return v;
    }
}
