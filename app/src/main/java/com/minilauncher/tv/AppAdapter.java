package com.minilauncher.tv;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

final class AppAdapter extends BaseAdapter {
    private final LayoutInflater inflater;
    private final GridView grid;
    private List<AppEntry> items = new ArrayList<>();

    AppAdapter(LayoutInflater inflater, GridView grid) {
        this.inflater = inflater;
        this.grid = grid;
    }

    void setItems(List<AppEntry> items) {
        this.items = items;
        notifyDataSetChanged();
    }

    @Override public int getCount() { return items.size(); }
    @Override public AppEntry getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return items.get(position).packageName.hashCode(); }
    @Override public boolean hasStableIds() { return true; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View v = convertView;
        Holder h;
        if (v == null) {
            v = inflater.inflate(R.layout.item_app, parent, false);
            h = new Holder(v);
            v.setTag(h);
        } else {
            h = (Holder) v.getTag();
            // Recycled views must not keep the "focused" look of another tile.
            v.setScaleX(1f);
            v.setScaleY(1f);
            h.card.setActivated(false);
            h.label.setTextColor(v.getResources().getColor(R.color.text_dim, null));
        }

        int colWidth = grid.getColumnWidth();
        if (colWidth > 0) {
            ViewGroup.LayoutParams lp = h.card.getLayoutParams();
            int wanted = colWidth * 9 / 16;
            if (lp.height != wanted) {
                lp.height = wanted;
                h.card.setLayoutParams(lp);
            }
        }

        AppEntry app = items.get(position);
        h.label.setText(app.label);
        if (app.banner != null) {
            h.banner.setImageDrawable(app.banner);
            h.banner.setVisibility(View.VISIBLE);
            h.icon.setVisibility(View.GONE);
        } else {
            h.icon.setImageDrawable(app.icon);
            h.icon.setVisibility(View.VISIBLE);
            h.banner.setVisibility(View.GONE);
        }
        return v;
    }

    static final class Holder {
        final View card;
        final ImageView banner;
        final ImageView icon;
        final TextView label;

        Holder(View v) {
            card = v.findViewById(R.id.card);
            banner = v.findViewById(R.id.banner);
            icon = v.findViewById(R.id.icon);
            label = v.findViewById(R.id.label);
        }
    }
}
