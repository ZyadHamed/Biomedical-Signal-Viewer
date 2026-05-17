import json
import os
import numpy as np
import pandas as pd
import json
import mne
from pathlib import Path
# EEGBCI (PhysioNet Motor Movement DB) uses the standard 10-05 64-channel layout.
# mne.datasets.eegbci.standardize() renames channels to this set:
EEGBCI_CHANNELS = [
    "Fc5", "Fc3", "Fc1", "Fcz", "Fc2", "Fc4", "Fc6",
    "C5",  "C3",  "C1",  "Cz",  "C2",  "C4",  "C6",
    "Cp5", "Cp3", "Cp1", "Cpz", "Cp2", "Cp4", "Cp6",
    "Fp1", "Fpz", "Fp2",
    "Af7", "Af3", "Afz", "Af4", "Af8",
    "F7",  "F5",  "F3",  "F1",  "Fz",  "F2",  "F4",  "F6",  "F8",
    "Ft7", "Ft8",
    "T7",  "T8",  "T9",  "T10",
    "Tp7", "Tp8",
    "P7",  "P5",  "P3",  "P1",  "Pz",  "P2",  "P4",  "P6",  "P8",
    "Po7", "Po3", "Poz", "Po4", "Po8",
    "O1",  "Oz",  "O2",
    "Iz",
]  # 64 channels

# CHB-MIT scalp EEG uses a 23-channel subset of the 10-20 system.
# From the CHB-MIT dataset documentation / chb01-summary.txt.
CHBMIT_CHANNELS = [
    "FP1-F7", "F7-T7",  "T7-P7",  "P7-O1",
    "FP1-F3", "F3-C3",  "C3-P3",  "P3-O1",
    "FP2-F4", "F4-C4",  "C4-P4",  "P4-O2",
    "FP2-F8", "F8-T8",  "T8-P8",  "P8-O2",
    "FZ-CZ",  "CZ-PZ",
    "P7-T7",  "T7-FT9", "FT9-FT10","FT10-T8",
    "T8-P8-1",  # some files have an extra channel
]  # 23 channels (bipolar montage)

# Sleep-EDF: MNE fetches EEG channels only (via pick_types eeg=True).
# The cassette recordings contain 2 EEG channels + others; after EEG pick:
SLEEP_EDF_CHANNELS = ["EEG Fpz-Cz", "EEG Pz-Oz"]  # 2 EEG channels

# UCI EEG Alcoholism dataset: 64 channels, standard 10-20 names.
# From the UCI dataset documentation:
UCI_ALCOHOLISM_CHANNELS = [
    "FP1", "FP2",
    "F7",  "F3",  "FZ",  "F4",  "F8",
    "FT7", "FC3", "FCZ", "FC4", "FT8",
    "T3",  "C3",  "CZ",  "C4",  "T4",
    "TP7", "CP3", "CPZ", "CP4", "TP8",
    "T5",  "P3",  "PZ",  "P4",  "T6",
    "PO3", "POZ", "PO4",
    "O1",  "OZ",  "O2",
    "AF7", "AF3", "AFZ", "AF4", "AF8",
    "F5",  "F1",  "F2",  "F6",
    "FC5", "FC1", "FC2", "FC6",   # ← removed the bogus FT7b/FT8b duplicates
    "C5",  "C1",  "C2",  "C6",
    "CP5", "CP1", "CP2", "CP6",   # ← removed the bogus TP7b/TP8b duplicates
    "P5",  "P1",  "P2",  "P6",
    "PO7", "PO8",
    "CB1", "CB2",
]  # 64 channels exactly
# EEGMAT (PhysioNet): 14-channel Emotiv EPOC headset.
# From the EEGMAT dataset description:
EEGMAT_CHANNELS = [
    # 19 EEG channels (10-20 system)
    "Fp1", "Fp2",
    "F7",  "F3",  "Fz",  "F4",  "F8",
    "T3",  "C3",  "Cz",  "C4",  "T4",
    "T5",  "P3",  "Pz",  "P4",  "T6",
    "O1",  "O2",
    # 2 auxiliary channels
    "X1",  "X2",
]  # 21 channels

# Map each category (and its data source) to its channel list
CATEGORY_CHANNELS = {
    # Source: EEGBCI run 1, standardize() applied → 64 ch
    "normal":               EEGBCI_CHANNELS,

    # Source: CHB-MIT ictal segments → 23 ch (bipolar)
    "seizure":              CHBMIT_CHANNELS,

    # Source: Sleep-EDF, EEG picks only → 2 ch
    "sleep_disorder":       SLEEP_EDF_CHANNELS,

    # Source: UCI alcoholism .rd files → 64 ch
    # Fallback slots filled with EEGBCI run 3 → 64 ch (same count, different names)
    "alcoholism":           UCI_ALCOHOLISM_CHANNELS,

    # Source: EEGBCI run 4, standardize() applied → 64 ch
    "motor_abnormality":    EEGBCI_CHANNELS,

    # Source: EEGMAT _2.edf → 14 ch
    # Fallback slots filled with EEGBCI run 2 → 64 ch (mixed; flag if mismatch)
    "mental_stress":        EEGMAT_CHANNELS,

    # Source: CHB-MIT pre-seizure segments (same files as seizure) → 23 ch
    "epileptic_interictal": CHBMIT_CHANNELS,
}


def infer_channel_names(npy_path: str) -> list[str] | None:
    """
    Infer channel names from the filename produced by the download script.
    Returns None if the channel count in the file doesn't match expectations
    (e.g. an EEGBCI fallback slot inside mental_stress), so the caller can
    fall back to generic CH_N labels.
    """
    basename = os.path.basename(npy_path)             # e.g. "mental_stress_03.npy"
    data = np.load(npy_path)
    n_channels = data.shape[0] if data.ndim == 2 else 1

    # Identify category from filename prefix
    for category, ch_list in CATEGORY_CHANNELS.items():
        if basename.startswith(category):
            if n_channels == len(ch_list):
                return ch_list
            else:
                # Channel count mismatch — likely a fallback recording
                # e.g. mental_stress filled with 64-ch EEGBCI instead of 14-ch EEGMAT
                print(
                    f"  ⚠ {basename}: expected {len(ch_list)} channels for '{category}' "
                    f"but found {n_channels}. "
                    f"{'Probably an EEGBCI fallback slot.' if n_channels == 64 else ''} "
                    f"Using generic CH_N labels."
                )
                return [f"CH_{i}" for i in range(n_channels)]

    # Unknown category
    return [f"CH_{i}" for i in range(n_channels)]

def npy_to_json(npy_path: str = None, max_samples: int = 100000,
                channel_names: list = None):
    """
    Convert a .npy EEG recording (channels, samples) + companion _sfreq.npy
    to a JSON file matching the format:
      { "signals": [[ch0,ch1,...], ...],  "channels": [...],  "fs": float }

    Channel names are inferred automatically from the filename/category
    unless explicitly provided via channel_names.
    """
    npy_path = str(npy_path)

    # ── Load data ──────────────────────────────────────────────────────────────
    data = np.load(npy_path)
    if data.ndim == 1:
        data = data[np.newaxis, :]
    if data.ndim != 2:
        raise ValueError(f"Expected 2-D array (channels, samples), got shape {data.shape}")

    n_channels, n_samples = data.shape

    samplingFreq = {
        "epileptic_interictal": 256, 
        "alcoholism_05": 160,
        "mental_stress": 500,
        "motor_abnormality": 160,
        "normal": 160,
        "seizure": 256
        }
    
    file_name = Path(npy_path).name
    fs = next((freq for key, freq in samplingFreq.items() if key in file_name), None)

    # ── Trim samples ───────────────────────────────────────────────────────────
    if n_samples > max_samples:
        print(f"  Trimming {n_samples} → {max_samples} samples")
        data = data[:, :max_samples]
        n_samples = max_samples

    # ── Channel names ──────────────────────────────────────────────────────────
    if channel_names is None:
        channel_names = infer_channel_names(npy_path)   # ← inferred automatically
    elif len(channel_names) != n_channels:
        raise ValueError(
            f"channel_names length ({len(channel_names)}) != array channels ({n_channels})"
        )

    # ── Build and write JSON ───────────────────────────────────────────────────
    payload = {
        "signals":  data.T.tolist(),   # (samples, channels)
        "channels": channel_names,
        "fs":       fs,
    }
    return payload


import os
import numpy as np
import torch
import torch.nn as nn
from braindecode.models import BIOT

CATEGORIES      = [
    "normal", "seizure", "alcoholism",
    "motor_abnormality", "mental_stress", "epileptic_interictal",]

BIOT_SFREQ      = 200
BIOT_N_CHANNELS = 18
BIOT_HOP        = 100
WINDOW_SEC      = 10.0
N_CLASSES       = 6


def resample_array(data, orig_sfreq, target_sfreq):
    if abs(orig_sfreq - target_sfreq) < 1:
        return data
    orig_len   = data.shape[1]
    target_len = int(orig_len * target_sfreq / orig_sfreq)
    x_old = np.linspace(0, 1, orig_len)
    x_new = np.linspace(0, 1, target_len)
    return np.stack([np.interp(x_new, x_old, ch) for ch in data])


def select_channels(data, n_target):
    n_ch = data.shape[0]
    if n_ch >= n_target:
        idx = np.round(np.linspace(0, n_ch - 1, n_target)).astype(int)
        return data[idx]
    pad = np.zeros((n_target - n_ch, data.shape[1]), dtype=data.dtype)
    return np.vstack([data, pad])


def load_eeg_file(eeg_path, default_sfreq=256.0):
    """Load .npy or raw EDF/BDF/FIF — returns (data, sfreq)."""
    ext = os.path.splitext(eeg_path)[1].lower()
    if ext == ".npy":
        data  = np.load(eeg_path).astype(np.float32)
        sfreq_path = eeg_path.replace(".npy", "_sfreq.npy")
        sfreq = float(np.load(sfreq_path)) if os.path.exists(sfreq_path) else default_sfreq
    elif ext in (".edf", ".bdf", ".fif", ".gdf"):
        mne.set_log_level("WARNING")
        raw   = mne.io.read_raw(eeg_path, preload=True, verbose=False)
        picks = mne.pick_types(raw.info, eeg=True)
        data  = raw.get_data(picks=picks).astype(np.float32)
        sfreq = raw.info["sfreq"]
    else:
        raise ValueError(f"Unsupported file format: {ext}. Use .npy, .edf, .bdf, or .fif")
    return data, sfreq


def PredictEEGSignal(eeg_path: str, default_sfreq: float = 256.0) -> str:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # ── Load model ────────────────────────────────────────────────────────────
    model = BIOT(
        n_outputs=2,
        n_chans=18,            # ← 18 channels, update BIOT_N_CHANNELS=18
        n_times=int(WINDOW_SEC * BIOT_SFREQ),
        sfreq=BIOT_SFREQ,
        hop_length=BIOT_HOP,
    )
    model.final_layer.classification_head = nn.Sequential(
    nn.Linear(256, 128),
    nn.GELU(),
    nn.Dropout(0.3),
    nn.LayerNorm(128),
    nn.Linear(128, N_CLASSES)
    )
    model.load_state_dict(torch.load("eeg_biot_best.pt", map_location=device))
    model.eval().to(device)

    # ── Load & preprocess EEG ─────────────────────────────────────────────────
    data, sfreq = load_eeg_file(eeg_path, default_sfreq)
    data = resample_array(data, sfreq, BIOT_SFREQ)
    data = select_channels(data, BIOT_N_CHANNELS)
    data = (data - data.mean(1, keepdims=True)) / (data.std(1, keepdims=True) + 1e-8)

    # ── Slice into windows & average logits (test-time aggregation) ───────────
    win_len  = int(WINDOW_SEC * BIOT_SFREQ)
    step_len = win_len // 2
    n_samp   = data.shape[1]

    if n_samp < win_len:
        data   = np.pad(data, ((0, 0), (0, win_len - n_samp)))
        n_samp = win_len

    windows = []
    for start in range(0, n_samp - win_len + 1, step_len):
        windows.append(data[:, start:start + win_len])

    x = torch.from_numpy(np.stack(windows).astype(np.float32)).to(device)

    with torch.no_grad():
        out = model(x)
        if isinstance(out, tuple):
            out = out[0]
        probs = torch.softmax(out, dim=1).mean(dim=0)   # average over windows

    pred_idx    = probs.argmax().item()
    pred_label  = CATEGORIES[pred_idx]
    confidence  = probs[pred_idx].item()

    result = pred_label.upper(), confidence
    return result
