package com.woori.mallang;

import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Locale;
import java.util.TimeZone;

/**
 * 휴대폰 캘린더(갤럭시 캘린더에 보이는 일정) 읽기 — 읽기만 하고 휴대폰 캘린더는 절대 바꾸지 않음.
 * 반복 일정은 안드로이드가 날짜마다 펼쳐 준 그대로(Instances) 가져옴.
 */
class PhoneCalendar {
    static boolean allowed(Context ctx) {
        return ctx.checkSelfPermission(android.Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    static String calendars(Context ctx) {
        JSONArray out = new JSONArray();
        if (!allowed(ctx)) return out.toString();
        String[] proj = { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.CALENDAR_COLOR, CalendarContract.Calendars.VISIBLE, CalendarContract.Calendars.ACCOUNT_TYPE };
        try (Cursor c = ctx.getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, proj, null, null, null)) {
            while (c != null && c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", c.getLong(0));
                o.put("name", c.getString(1) == null ? "" : c.getString(1));
                o.put("account", c.getString(2) == null ? "" : c.getString(2));
                o.put("color", String.format(Locale.US, "#%06X", c.getInt(3) & 0xFFFFFF));
                o.put("visible", c.getInt(4) == 1);
                o.put("type", c.getString(5) == null ? "" : c.getString(5));
                out.put(o);
            }
        } catch (Exception e) { /* 못 읽으면 빈 목록 */ }
        return out.toString();
    }

    static String events(Context ctx, String ids, long from, long to) {
        JSONArray out = new JSONArray();
        if (!allowed(ctx)) return out.toString();
        HashSet<Long> want = new HashSet<>();
        for (String s : (ids == null ? "" : ids).split(",")) try { want.add(Long.parseLong(s.trim())); } catch (Exception e) { /* 무시 */ }
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, from);
        ContentUris.appendId(b, to);
        String[] proj = { CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.CALENDAR_ID, CalendarContract.Instances.DISPLAY_COLOR, CalendarContract.Instances.EVENT_ID };
        TimeZone local = TimeZone.getDefault(), utc = TimeZone.getTimeZone("UTC");
        try (Cursor c = ctx.getContentResolver().query(b.build(), proj, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            while (c != null && c.moveToNext() && out.length() < 5000) {
                if (!want.isEmpty() && !want.contains(c.getLong(4))) continue;
                boolean allDay = c.getInt(3) == 1;
                long begin = c.getLong(1), end = c.getLong(2);
                JSONObject o = new JSONObject();
                o.put("title", c.getString(0) == null ? "" : c.getString(0));
                Calendar s = Calendar.getInstance(allDay ? utc : local);   // 종일 일정은 UTC 자정 기준으로 저장돼 있음
                s.setTimeInMillis(begin);
                o.put("d", String.format(Locale.US, "%04d-%02d-%02d", s.get(Calendar.YEAR), s.get(Calendar.MONTH) + 1, s.get(Calendar.DAY_OF_MONTH)));
                // 여러 날 일정: 끝나는 날 (종일 일정은 끝 시각이 다음 날 0시라서 하루 빼기)
                Calendar e = Calendar.getInstance(allDay ? utc : local);
                e.setTimeInMillis(Math.max(begin, allDay ? end - 1 : end - 1));
                o.put("e", String.format(Locale.US, "%04d-%02d-%02d", e.get(Calendar.YEAR), e.get(Calendar.MONTH) + 1, e.get(Calendar.DAY_OF_MONTH)));
                o.put("t", allDay ? "" : String.format(Locale.US, "%02d:%02d", s.get(Calendar.HOUR_OF_DAY), s.get(Calendar.MINUTE)));
                o.put("color", String.format(Locale.US, "#%06X", c.getInt(5) & 0xFFFFFF));
                o.put("cal", c.getLong(4));
                o.put("eid", c.getLong(6));
                out.put(o);
            }
        } catch (Exception e) { /* 못 읽으면 빈 목록 */ }
        return out.toString();
    }
}
