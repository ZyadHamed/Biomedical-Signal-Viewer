"""
Signal Data Converter - FIXED VERSION
Converts EEG (.set) and ECG (.dat/.hea) files to JSON format
"""

import json
import numpy as np
import struct
import sys
from pathlib import Path

def convert_eeg_to_json(set_file, channels_file, output_file, max_samples=100000):
    """
    Convert EEG .set file to JSON - IMPROVED VERSION
    """
    print(f"Converting EEG file: {set_file}")
    
    # Read channel names from TSV
    channels = []
    with open(channels_file, 'r') as f:
        lines = f.readlines()[1:]  # Skip header
        for line in lines:
            parts = line.strip().split('\t')
            if parts:
                channels.append(parts[0])
    
    print(f"Found {len(channels)} channels: {channels}")
    
    # Try multiple methods to read .set file
    success = False
    
    # Method 1: Try scipy.io.loadmat
    try:
        from scipy.io import loadmat
        print("Trying scipy.io.loadmat...")
        
        mat_data = loadmat(set_file, struct_as_record=False, squeeze_me=True)
        
        if 'EEG' in mat_data:
            eeg_struct = mat_data['EEG']
            if hasattr(eeg_struct, 'data'):
                signals = eeg_struct.data
                fs = int(eeg_struct.srate) if hasattr(eeg_struct, 'srate') else 500
                success = True
                print(f"✓ Successfully read with scipy (Method 1)")
            else:
                print("EEG structure found but no 'data' field")
        else:
            # Sometimes data is at root level
            if 'data' in mat_data:
                signals = mat_data['data']
                fs = int(mat_data.get('srate', 500))
                success = True
                print(f"✓ Successfully read data from root (Method 1b)")
    except Exception as e:
        print(f"scipy.io.loadmat failed: {e}")
    
    # Method 2: Try MNE library
    if not success:
        try:
            import mne
            print("Trying mne.io.read_raw_eeglab...")
            
            raw = mne.io.read_raw_eeglab(set_file, preload=True, verbose=False)
            signals = raw.get_data()  # shape: (n_channels, n_samples)
            fs = int(raw.info['sfreq'])
            success = True
            print(f"✓ Successfully read with MNE (Method 2)")
            raw.close()
        except Exception as e:
            print(f"MNE failed: {e}")
    
    # Method 3: Read as binary (last resort)
    if not success:
        try:
            print("Trying binary read (Method 3)...")
            
            # Read entire file as binary
            with open(set_file, 'rb') as f:
                file_content = f.read()
            
            # Look for the data section in the MATLAB file
            # MATLAB files have a specific structure
            # Try to find continuous float32 data
            
            # Skip MATLAB header (usually 128 bytes)
            data_start = 128
            
            # Try reading as float32
            float_data = np.frombuffer(file_content[data_start:], dtype=np.float32)
            
            n_channels = len(channels)
            n_samples = len(float_data) // n_channels
            
            if n_samples > 0:
                signals = float_data[:n_samples * n_channels].reshape((n_channels, n_samples))
                fs = 500  # Default
                success = True
                print(f"✓ Successfully read as binary (Method 3)")
                print(f"  Detected {n_samples} samples")
        except Exception as e:
            print(f"Binary read failed: {e}")
    
    if not success:
        print("\n❌ ERROR: Could not read .set file with any method!")
        print("\nPossible solutions:")
        print("1. Install scipy: pip install scipy")
        print("2. Install MNE: pip install mne")
        print("3. Check if the .set file is corrupted")
        return False
    
    # Verify data shape
    if signals.ndim != 2:
        print(f"Error: Expected 2D array, got shape {signals.shape}")
        return False
    
    if signals.shape[0] != len(channels):
        print(f"Warning: Channel count mismatch. Data has {signals.shape[0]} channels, expected {len(channels)}")
        # Adjust if needed
        if signals.shape[0] < len(channels):
            channels = channels[:signals.shape[0]]
        else:
            signals = signals[:len(channels), :]
    
    # Limit samples
    if signals.shape[1] > max_samples:
        print(f"Limiting from {signals.shape[1]} to {max_samples} samples")
        signals = signals[:, :max_samples]
    
    # Transpose to (samples, channels) format
    signals_transposed = signals.T.tolist()
    
    # Create output JSON
    output = {
        "signals": signals_transposed,
        "channels": channels,
        "fs": fs
    }
    
    with open(output_file, 'w') as f:
        json.dump(output, f)
    
    print(f"\n✓ Saved EEG data to {output_file}")
    print(f"  Shape: {signals.shape[1]} samples x {signals.shape[0]} channels")
    print(f"  Sampling rate: {fs} Hz")
    print(f"  Duration: {signals.shape[1]/fs:.1f} seconds")
    return True


def convert_ecg_to_json(dat_file, hea_file, output_file, max_samples=50000):
    """
    Convert ECG .dat/.hea files (WFDB format) to JSON
    """
    print(f"Converting ECG files: {dat_file} and {hea_file}")
    
    # Try using wfdb library first
    try:
        import wfdb
        record_name = str(Path(dat_file).with_suffix(''))
        record = wfdb.rdrecord(record_name)
        
        signals = record.p_signal
        channels = record.sig_name
        fs = record.fs
        
        print(f"Read {len(channels)} channels: {channels}")
        print(f"Sampling rate: {fs} Hz")
        
    except ImportError:
        print("wfdb library not found, reading manually...")
        
        # Read header file manually
        with open(hea_file, 'r') as f:
            lines = f.readlines()
        
        # Parse header
        header_line = lines[0].strip().split()
        n_channels = int(header_line[1])
        fs = int(header_line[2])
        n_samples = int(header_line[3])
        
        print(f"Header: {n_channels} channels, {fs} Hz, {n_samples} samples")
        
        # Get channel names
        channels = []
        for i in range(1, n_channels + 1):
            parts = lines[i].strip().split()
            channels.append(parts[-1])
        
        print(f"Channels: {channels}")
        
        # Read binary data
        with open(dat_file, 'rb') as f:
            raw_data = np.fromfile(f, dtype=np.int16)
        
        # Reshape to (samples x channels)
        n_samples_actual = len(raw_data) // n_channels
        signals = raw_data[:n_samples_actual * n_channels].reshape((n_samples_actual, n_channels))
        
        # Convert to physical units (mV)
        signals = signals.astype(np.float32) / 1000.0
    
    # Limit samples
    if signals.shape[0] > max_samples:
        print(f"Limiting from {signals.shape[0]} to {max_samples} samples")
        signals = signals[:max_samples, :]
    
    # Create output JSON
    output = {
        "signals": signals.tolist(),
        "channels": channels,
        "fs": int(fs)
    }
    
    with open(output_file, 'w') as f:
        json.dump(output, f)
    
    print(f"\n✓ Saved ECG data to {output_file}")
    print(f"  Shape: {signals.shape[0]} samples x {signals.shape[1]} channels")
    print(f"  Sampling rate: {fs} Hz")
    print(f"  Duration: {signals.shape[0]/fs:.1f} seconds")
    return True


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  For EEG: python convert_to_json.py eeg <set_file> <channels_tsv> <output.json>")
        print("  For ECG: python convert_to_json.py ecg <dat_file> <hea_file> <output.json>")
        return
    
    signal_type = sys.argv[1].lower()
    
    if signal_type == 'eeg':
        if len(sys.argv) != 5:
            print("Usage: python convert_to_json.py eeg <set_file> <channels_tsv> <output.json>")
            return
        convert_eeg_to_json(sys.argv[2], sys.argv[3], sys.argv[4])
        
    elif signal_type == 'ecg':
        if len(sys.argv) != 5:
            print("Usage: python convert_to_json.py ecg <dat_file> <hea_file> <output.json>")
            return
        convert_ecg_to_json(sys.argv[2], sys.argv[3], sys.argv[4])
        
    else:
        print("Signal type must be 'eeg' or 'ecg'")


if __name__ == "__main__":
    main()