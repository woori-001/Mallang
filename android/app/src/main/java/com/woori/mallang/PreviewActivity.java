package com.woori.mallang;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;

/** 확인용: 홈 화면에 올리지 않고 위젯 모습만 그대로 그려 보는 화면 (빌드 서버에서 화면 캡처할 때 씀) */
public class PreviewActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String json = getIntent().getStringExtra("data");
        String b64 = getIntent().getStringExtra("b64");
        if (b64 != null) json = new String(android.util.Base64.decode(b64, android.util.Base64.DEFAULT), java.nio.charset.StandardCharsets.UTF_8);
        int off = getIntent().getIntExtra("off", 0);
        int w = getIntent().getIntExtra("w", 330), h = getIntent().getIntExtra("h", 380);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#" + (getIntent().hasExtra("wall") ? getIntent().getStringExtra("wall") : "9FB7D9")));
        View v = CalendarWidget.build(this, json == null ? "{}" : json, off, h).apply(this, root);
        float dp = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, getResources().getDisplayMetrics());
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams((int) (w * dp), (int) (h * dp), Gravity.CENTER);
        root.addView(v, lp);
        setContentView(root);
    }
}
