package com.minilauncher.tv;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;

/** A 16:9 tile drawn in code: coloured card, big emoji, game name and variant. */
final class GameBanner extends Drawable {
    private final int color;
    private final String icon;
    private final String title;
    private final String variant;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

    GameBanner(int color, String icon, String title, String variant) {
        this.color = color;
        this.icon = icon;
        this.title = title;
        this.variant = variant;
    }

    @Override
    public void draw(Canvas c) {
        Rect b = getBounds();
        float w = b.width(), h = b.height();
        float r = h * 0.08f;
        paint.setShader(null);
        paint.setColor(color);
        c.drawRoundRect(new RectF(b), r, r, paint);

        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(Typeface.DEFAULT);
        paint.setColor(0xFFFFFFFF);
        paint.setTextSize(h * 0.36f);
        c.drawText(icon, b.left + w / 2f, b.top + h * 0.50f, paint);

        paint.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        paint.setTextSize(h * 0.15f);
        c.drawText(ellipsize(title, w * 0.9f), b.left + w / 2f, b.top + h * 0.73f, paint);

        if (!variant.isEmpty()) {
            paint.setTypeface(Typeface.DEFAULT);
            paint.setColor(0xCCFFFFFF);
            paint.setTextSize(h * 0.11f);
            c.drawText(ellipsize(variant, w * 0.9f), b.left + w / 2f, b.top + h * 0.89f, paint);
        }
    }

    private String ellipsize(String s, float max) {
        if (paint.measureText(s) <= max) return s;
        while (s.length() > 1 && paint.measureText(s + "…") > max) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    @Override public int getIntrinsicWidth() { return 320; }
    @Override public int getIntrinsicHeight() { return 180; }
    @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
    @Override public void setColorFilter(ColorFilter cf) { paint.setColorFilter(cf); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
