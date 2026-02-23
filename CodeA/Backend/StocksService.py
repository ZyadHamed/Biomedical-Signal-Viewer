import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from sklearn.linear_model import RidgeCV
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

OHLC   = ["open", "high", "low", "close"]
RATIOS = ["r_open", "r_high", "r_low", "r_close"]

DARK    = "#0a0e1a"
PANEL   = "#10151f"
GRID    = "#1e2535"
UP      = "#00d4aa"
DN      = "#ff4d6d"
FUP     = "#38bdf8"
FDN     = "#fb923c"
TEXT    = "#e2e8f0"
MUTED   = "#64748b"
CLOSE_L = "#fbbf24"

ALPHA_GRID = np.logspace(-2, 4, 50)


def validate(df):
    df = df.copy()
    df.columns = [c.lower().strip() for c in df.columns]
    missing = [c for c in OHLC if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    df = df.dropna(subset=OHLC).reset_index(drop=True)
    df[OHLC] = df[OHLC].astype(float)
    return df


def encode(prices):
    """Convert raw OHLC prices to log-ratio space."""
    N = len(prices)
    enc = np.zeros((N - 1, 4))
    for i in range(1, N):
        pc = prices[i - 1, 3]
        o  = prices[i, 0]
        enc[i-1, 0] = np.log(o  / (pc + 1e-9))   # log r_open
        enc[i-1, 1] = np.log(prices[i, 1] / (o + 1e-9))   # log r_high
        enc[i-1, 2] = np.log(prices[i, 2] / (o + 1e-9))   # log r_low
        enc[i-1, 3] = np.log(prices[i, 3] / (o + 1e-9))   # log r_close
    return enc


def decode_bar(log_ratios, prev_close):
    """Convert predicted log-ratios back to real OHLC prices."""
    o = np.exp(log_ratios[0]) * prev_close
    return np.array([
        o,
        np.exp(log_ratios[1]) * o,
        np.exp(log_ratios[2]) * o,
        np.exp(log_ratios[3]) * o,
    ])


def features(window, extra_close=False):
    flat    = window.flatten()
    r_close = window[:, 3]
    r_high  = window[:, 1]
    r_low   = window[:, 2]
    r_open  = window[:, 0]

    # --- original summary stats ---
    vol             = float(r_close.std())
    momentum        = float(r_close[-1] - r_close[0])
    hi_prem         = float(r_high.mean())
    lo_disc         = float((-r_low).mean())
    slope           = float(np.polyfit(np.linspace(0, 1, len(r_close)), r_close, 1)[0])

    # --- new hand-crafted interactions ---
    open_close_spread = float((r_close - r_open).mean())
    wick_ratio        = float((r_high / ((-r_low) + 1e-9)).mean())
    body_size         = float(np.abs(r_close - r_open).mean())
    hl_range          = float((r_high - r_low).mean())
    close_position    = float(((r_close - r_low) / (r_high - r_low + 1e-9)).mean())
    autocorr          = float(np.corrcoef(r_close[:-1], r_close[1:])[0, 1]) if len(r_close) > 2 else 0.0

    # --- multi-scale stats (short=5, medium=15) ---
    multi = []
    for w in [5, 15]:
        if len(window) >= w:
            sub = window[-w:, 3]
            multi += [float(sub.std()), float(sub[-1] - sub[0])]
        else:
            multi += [0.0, 0.0]

    extra = [
        vol, momentum, hi_prem, lo_disc, slope,
        open_close_spread, wick_ratio, body_size, hl_range, close_position, autocorr,
    ] + multi

    if extra_close:
        alpha_ema = 2.0 / (len(r_close) + 1)
        ema = r_close[0]
        for v in r_close[1:]:
            ema = alpha_ema * v + (1 - alpha_ema) * ema
        ema_ratio = float(r_close[-1] / (ema + 1e-9))

        mean_rc = float(r_close.mean())
        std_rc  = float(r_close.std()) + 1e-9
        zscore  = float((r_close[-1] - mean_rc) / std_rc)

        extra += [ema_ratio, zscore]

    return np.concatenate([flat, extra])[np.newaxis, :]


def build_dataset(enc, lookback):
    X, Y = [], []
    for i in range(lookback, len(enc)):
        w = enc[i - lookback: i]
        X.append(features(w, extra_close=True)[0])
        Y.append(enc[i])
    X = np.array(X)
    return X[:, :-2], X, np.array(Y)   # X_std, X_close, Y


def detect_vol_clip(enc, base_clip, multiplier):
    """Widen the log-ratio clip when recent volatility exceeds the global baseline."""
    r_close    = enc[:, 3]
    global_std = float(r_close.std()) + 1e-9
    recent_std = float(r_close[-min(20, len(r_close)):].std()) + 1e-9
    vol_ratio  = recent_std / global_std
    if vol_ratio > 1.2:
        scale = min(vol_ratio * multiplier, 3.0)
        return base_clip * scale
    return base_clip


def styled_ax(ax, title="", xlabel="", ylabel=""):
    ax.set_facecolor(PANEL)
    ax.tick_params(colors=MUTED, labelsize=8)
    for sp in ax.spines.values():
        sp.set_edgecolor(GRID)
    ax.grid(color=GRID, lw=0.5, ls="--", alpha=0.6)
    if title:  ax.set_title(title,   color=TEXT,  fontsize=9.5, fontweight="bold", pad=8)
    if xlabel: ax.set_xlabel(xlabel, color=MUTED, fontsize=8)
    if ylabel: ax.set_ylabel(ylabel, color=MUTED, fontsize=8)


def draw_candles(ax, data, offset=0, cup=UP, cdn=DN, alpha=1.0):
    for i, row in data.reset_index(drop=True).iterrows():
        x = i + offset
        o, h, l, c = row["open"], row["high"], row["low"], row["close"]
        color = cup if c >= o else cdn
        ax.plot([x, x], [l, h], color=color, lw=0.85, alpha=alpha, zorder=2)
        body_lo = min(o, c)
        body_h  = max(abs(c - o), 1e-8)
        ax.add_patch(mpatches.FancyBboxPatch(
            (x - 0.275, body_lo), 0.55, body_h,
            boxstyle="square,pad=0", lw=0.25,
            edgecolor=color, facecolor=color, alpha=alpha, zorder=3,
        ))


class OHLCRidge:
    def __init__(self, lookback=30, poly_degree=2, n_splits=5, ratio_clip=0.10):
        self.lookback    = lookback
        self.poly_degree = poly_degree
        self.n_splits    = n_splits
        self.ratio_clip  = ratio_clip

        self.pipes        = {}
        self.cv_losses    = {r: [] for r in RATIOS}
        self.train_metrics = {}
        self.residuals    = None
        self.fitted       = False
        self.active_clip  = ratio_clip

    def make_pipe(self):
        return Pipeline([
            ("poly",   PolynomialFeatures(self.poly_degree, interaction_only=True, include_bias=False)),
            ("scaler", StandardScaler()),
            ("ridge",  RidgeCV(alphas=ALPHA_GRID, cv=None)),
        ])

    def check_fitted(self):
        if not self.fitted:
            raise RuntimeError("Call .fit(df) first.")

    def fit(self, df, vol_multiplier=1.5):
        df     = validate(df)
        prices = df[OHLC].values.astype(float)
        enc    = encode(prices)
        X_std, X_close, Y = build_dataset(enc, self.lookback)
    
        self.active_clip = detect_vol_clip(enc, self.ratio_clip, vol_multiplier)
    
        metrics  = {}
        res_data = {}
    
        for col_idx, (ratio_name, ohlc_name) in enumerate(zip(RATIOS, OHLC)):
            is_close = ohlc_name == "close"
            X        = X_close if is_close else X_std
            y        = Y[:, col_idx]
    
            p = self.make_pipe()
            p.fit(X, y)
            self.pipes[ratio_name] = p
    
            chosen_alpha = float(p.named_steps["ridge"].alpha_)
            print(f"[OHLCRidge] {ratio_name:8s}  chosen alpha={chosen_alpha:.4g}")
    
            y_hat = p.predict(X)
            res_data[ohlc_name + "_actual"]    = y
            res_data[ohlc_name + "_predicted"] = y_hat
            res_data[ohlc_name + "_residual"]  = y - y_hat
    
            metrics[ohlc_name] = {
                "MAE":   round(float(mean_absolute_error(y, y_hat)), 8),
                "RMSE":  round(float(np.sqrt(mean_squared_error(y, y_hat))), 8),
                "R2":    round(float(r2_score(y, y_hat)), 6),
                "alpha": round(chosen_alpha, 4),
            }
    
        self.residuals     = pd.DataFrame(res_data)
        self.train_metrics = metrics
        self.fitted        = True
    
        return metrics

    def predict(self, df, n_days=10):
        self.check_fitted()
        df = validate(df)
        if len(df) < self.lookback + 1:
            raise ValueError(f"Need at least {self.lookback + 1} rows; got {len(df)}.")

        prices     = df[OHLC].values.astype(float)
        enc        = encode(prices)
        window     = enc[-self.lookback:].copy()
        prev_close = float(prices[-1, 3])
        rc         = self.active_clip
        out        = []

        for _ in range(n_days):
            feat_std   = features(window, extra_close=False)
            feat_close = features(window, extra_close=True)

            log_ratios = np.array([
                self.pipes["r_open"] .predict(feat_std)[0],
                self.pipes["r_high"] .predict(feat_std)[0],
                self.pipes["r_low"]  .predict(feat_std)[0],
                self.pipes["r_close"].predict(feat_close)[0],
            ])

            # Structural clamping in log space
            log_ratios[0] = np.clip(log_ratios[0], -rc,  rc)    # r_open
            log_ratios[1] = np.clip(log_ratios[1],  0.0, rc)    # r_high log >= 0
            log_ratios[2] = np.clip(log_ratios[2], -rc,  0.0)   # r_low  log <= 0
            log_ratios[3] = np.clip(log_ratios[3], -rc,  rc)    # r_close

            # high must be >= |close|, low must be <= min(0, close)
            log_ratios[1] = max(log_ratios[1], abs(log_ratios[3]))
            log_ratios[2] = min(log_ratios[2], min(0.0, log_ratios[3]))

            bar = decode_bar(log_ratios, prev_close)
            out.append(bar)
            window     = np.vstack([window[1:], log_ratios])
            prev_close = float(bar[3])

        return pd.DataFrame(out, columns=OHLC)

    def metrics_df(self):
        """Return training metrics as a formatted DataFrame."""
        self.check_fitted()
        return pd.DataFrame(self.train_metrics).T

    def save(self, path):
        path = Path(path)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        print(f"[OHLCRidge] saved → {path}")
        return path

    @staticmethod
    def load(path):
        with open(Path(path), "rb") as f:
            obj = pickle.load(f)
        if not isinstance(obj, OHLCRidge):
            raise TypeError("File does not contain an OHLCRidge model.")
        print(f"[OHLCRidge] loaded ← {path}")
        return obj

    def plot_forecast(self, df, n_days=10, history_bars=60, title="OHLC Forecast", show=True):
        self.check_fitted()
        df       = validate(df)
        forecast = self.predict(df, n_days=n_days)
        hist     = df.tail(history_bars).reset_index(drop=True)

        fig, ax = plt.subplots(figsize=(18, 7))
        fig.patch.set_facecolor(DARK)
        styled_ax(ax, title=title, xlabel="Bar index", ylabel="Price")

        n_hist = len(hist)
        draw_candles(ax, hist,     offset=0,          cup=UP,  cdn=DN,  alpha=0.95)
        draw_candles(ax, forecast, offset=n_hist + 2, cup=FUP, cdn=FDN, alpha=0.85)

        close_hist = list(hist["close"])
        close_fore = list(forecast["close"])
        x_hist     = list(range(n_hist))
        x_fore     = [n_hist + 2 + i for i in range(n_days)]

        ax.plot(x_hist, close_hist, color=CLOSE_L, lw=1.5, zorder=5, alpha=0.9,
                label="Close (actual)")
        ax.plot(x_fore, close_fore, color=CLOSE_L, lw=2.0, zorder=5, alpha=1.0,
                linestyle="--", label="Close (forecast)")
        ax.plot([x_hist[-1], x_fore[0]], [close_hist[-1], close_fore[0]],
                color=CLOSE_L, lw=1.2, ls=":", alpha=0.6, zorder=5)

        sep        = n_hist + 1
        ylo, yhi   = ax.get_ylim()
        ax.axvline(sep, color=MUTED, lw=1.2, ls="--", alpha=0.55)
        ax.text(sep + 0.4, yhi - (yhi - ylo) * 0.04,
                f"▶ {n_days}-bar forecast", color=FUP, fontsize=8, va="top")

        ax.legend(handles=[
            mpatches.Patch(color=UP,      label="Actual ↑"),
            mpatches.Patch(color=DN,      label="Actual ↓"),
            mpatches.Patch(color=FUP,     label="Forecast ↑"),
            mpatches.Patch(color=FDN,     label="Forecast ↓"),
            mpatches.Patch(color=CLOSE_L, label="Close line"),
        ], loc="upper left", facecolor=PANEL, edgecolor=GRID,
           labelcolor=TEXT, fontsize=8)

        plt.tight_layout()
        if show:
            plt.show()
        return fig

    def plot_loss(self, show=True):
        self.check_fitted()
        colors = ["#a78bfa", "#34d399", "#f472b6", CLOSE_L]

        fig, axes = plt.subplots(1, 4, figsize=(18, 4))
        fig.patch.set_facecolor(DARK)
        fig.suptitle("CV MSE per Fold (TimeSeriesSplit — log-ratio space)",
                     color=TEXT, fontsize=12, fontweight="bold", y=1.02)

        for ax, ratio, col, color in zip(axes, RATIOS, OHLC, colors):
            losses = self.cv_losses[ratio]
            folds  = [f"F{i+1}" for i in range(len(losses))]
            bars   = ax.bar(folds, losses, color=color, alpha=0.82,
                            edgecolor=DARK, lw=0.8, zorder=3)
            for bar, v in zip(bars, losses):
                ax.text(bar.get_x() + bar.get_width() / 2,
                        bar.get_height() * 1.015, f"{v:.2e}",
                        ha="center", va="bottom", color=TEXT, fontsize=7)
            mu = float(np.mean(losses))
            ax.axhline(mu, color=TEXT, lw=1.1, ls="--", alpha=0.5, zorder=4)
            chosen = self.train_metrics[col].get("alpha", "?")
            styled_ax(ax, title=f"{col.upper()}  α={chosen}", ylabel="MSE")

        plt.tight_layout()
        if show:
            plt.show()
        return fig

    def plot_residuals(self, show=True):
        self.check_fitted()
        colors = ["#a78bfa", "#34d399", "#f472b6", CLOSE_L]
        fig, axes = plt.subplots(2, 4, figsize=(20, 9))
        fig.patch.set_facecolor(DARK)
        fig.suptitle("Residual Diagnostics", color=TEXT,
                     fontsize=13, fontweight="bold", y=1.01)

        for ci, (col, color) in enumerate(zip(OHLC, colors)):
            actual    = self.residuals[col + "_actual"].values
            predicted = self.residuals[col + "_predicted"].values
            residual  = self.residuals[col + "_residual"].values
            m         = self.train_metrics[col]

            ax = axes[0, ci]
            ax.scatter(actual, predicted, c=color, s=7, alpha=0.35,
                       linewidths=0, zorder=3)
            mn, mx = actual.min(), actual.max()
            ax.plot([mn, mx], [mn, mx], color=TEXT, lw=1.3, ls="--",
                    alpha=0.55, zorder=4)
            styled_ax(ax,
                title=f"{col.upper()}  R²={m['R2']:.4f}  RMSE={m['RMSE']:.2e}",
                xlabel="Actual", ylabel="Predicted")

            ax2 = axes[1, ci]
            ax2.hist(residual, bins=45, color=color, alpha=0.75,
                     edgecolor=DARK, lw=0.4, zorder=3)
            ax2.axvline(0, color=TEXT, lw=1.4, ls="--", alpha=0.8, zorder=5)
            ax2.axvline(residual.mean(), color="#fbbf24", lw=1.2,
                        label=f"mean={residual.mean():.2e}", zorder=5)
            ax2.legend(facecolor=PANEL, edgecolor=GRID, labelcolor=TEXT, fontsize=7)
            styled_ax(ax2, title=f"{col.upper()} Residuals",
                      xlabel="Residual", ylabel="Freq")

        plt.tight_layout()
        if show:
            plt.show()
        return fig

    def plot_all(self, df, n_days=10, show=True):
        """Render all three plots. Returns (forecast_fig, loss_fig, residuals_fig)."""
        self.check_fitted()
        return (
            self.plot_forecast(df, n_days=n_days, show=show),
            self.plot_loss(show=show),
            self.plot_residuals(show=show),
        )
    

def clean_df(df):
    df.columns = [c.lower().strip() for c in df.columns]
    
    # If no close column, approximate it from available columns
    if "close" not in df.columns:
        if "price" in df.columns:
            df["close"] = df["price"]
        elif "last" in df.columns:
            df["close"] = df["last"]
        elif "adj close" in df.columns:
            df["close"] = df["adj close"]
    
    # If still missing open/high/low, approximate from close
    for col in ["open", "high", "low"]:
        if col not in df.columns:
            df[col] = df["close"]

    # Strip commas from numbers like "1,234.56"
    for col in ["open", "high", "low", "close"]:
        df[col] = df[col].astype(str).str.replace(",", "", regex=False)

    df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].apply(pd.to_numeric, errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close"])

    return df

from pathlib import Path

def PredictStockSignal(csv_path,):
    df = clean_df(pd.read_csv(csv_path))
    n_days = len(df)
    forecast = Forecast(csv_path, n_days=n_days+10)
    
    output = {
        "original": {
            "signals": df[["open", "high", "low", "close"]].values.tolist(),
            "channels": ["open", "high", "low", "close"],
            "fs": 1
        },
        "forecast": {
            "signals": forecast[["open", "high", "low", "close"]].values.tolist(),
            "channels": ["open", "high", "low", "close"],
            "fs": 1
        }
    }

    return output

def Forecast(csv_path, n_days=10, extra_forecast_multiplier=0.1):
    import __main__
    __main__.OHLCRidge = OHLCRidge
    with open("models.pkl", "rb") as f:
        models = pickle.load(f)
    
    df = clean_df(pd.read_csv(csv_path))
    p = Path(csv_path)
    model = models[p.stem]
    
    lookback = 31
    step = 5
    all_predictions = []

    # Rolling predictions over the original signal
    for start in range(0, len(df) - lookback, step):
        window = df.iloc[start: start + lookback]
        if len(window) < lookback:
            break
        pred = model.predict(window, n_days=step)
        all_predictions.append(pred)

    # Extra predictions beyond the original signal
    # Use the last `lookback` rows of df as the seed window
    extra_days = int(len(df) * extra_forecast_multiplier)
    extra_pred = model.predict(df.tail(lookback), n_days=extra_days)
    all_predictions.append(extra_pred)

    return pd.concat(all_predictions, ignore_index=True)