package com.woori.mallang;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/** 설치 진행 알림: 안드로이드가 "설치할까요?" 확인을 원하면 그 화면을 띄움 */
public class InstallResult extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); ctx.startActivity(confirm); }
        } else if (st != PackageInstaller.STATUS_SUCCESS) {
            String msg = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            if (st != PackageInstaller.STATUS_FAILURE_ABORTED)
                Toast.makeText(ctx, "설치하지 못했어요" + (msg != null ? " (" + msg + ")" : ""), Toast.LENGTH_LONG).show();
        }
    }
}
