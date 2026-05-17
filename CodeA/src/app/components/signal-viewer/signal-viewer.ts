import { Component, OnInit, OnDestroy, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DopplerComponent } from '../doppler/doppler';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Microbiome } from "../microbiome/microbiome";
import { DroneDetectoromponent } from "../DroneDetector/DroneDetector";
import { SignalGraphComponent, SignalGraphConfig } from '../signal-graph/signal-graph.component';
import { StockPredictComponent } from "../stock-analyzer/stock-predict.component";

interface SignalData {
  signals: number[][];
  channels: string[];
  fs: number;
}

@Component({
  selector: 'app-signal-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, DopplerComponent, Microbiome, DroneDetectoromponent, SignalGraphComponent, StockPredictComponent],
  templateUrl: './signal-viewer.html',
  styleUrls: ['./signal-viewer.css'],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None
})
export class SignalViewerComponent implements OnInit, OnDestroy {
  @ViewChild(SignalGraphComponent) signalGraph!: SignalGraphComponent;

  // Workflow state
  step: number = 1;
  signalType: string = '';
  channelMode: string = '';

  // Display mode
  displayMode: 'time' | 'reoccurrence' | 'polar' | 'xor' = 'time';

  // Polar
  polarMode: 'fixed' | 'cumulative' = 'fixed';

  selectedFile: string = ''

  // Reoccurrence
  reoccurrenceColorMap: string = 'Viridis';
  colorMapOptions: string[] = ['Viridis', 'Plasma', 'Inferno', 'Jet', 'Hot', 'Blues', 'Electric'];
  reoccurrenceChX: number = 0;
  reoccurrenceChY: number = 0;

  // Diagnosis
  diagnosis: string = "";
  confidence: number = 0;
  mlDiagnosis: string = "";
  mlConfidence: number = 0;

  // Signal data
  originalSignals: number[][] = [];
  fullSignals: number[][] = [];
  channels: string[] = [];
  originalFs: number = 500;
  displayFs: number = 500;

  // Channel selection
  selectedChannels: boolean[] = [];

  constructor(public cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

  // ── No timer here. The child (SignalGraphComponent) owns the playback loop. ──

  ngOnDestroy(): void {
    // Nothing to clean up — child handles its own timer
  }

  // ── Navigation ───────────────────────────────────────────────────
  selectSignalType(type: string): void {
    this.signalType = type;
    this.step = 2;
    this.cdr.detectChanges();
  }

  selectChannelMode(mode: string): void {
    this.channelMode = mode;
    this.step = 3;
    this.cdr.detectChanges();
  }

  goBack(): void {
    if (this.step > 1) {
      this.step--;
      if (this.step === 1) { this.signalType = ''; this.channelMode = ''; this.resetData(); }
      if (this.step === 2) { this.channelMode = ''; this.resetData(); }
      this.cdr.detectChanges();
    }
  }

  resetData(): void {
    this.originalSignals = [];
    this.fullSignals = [];
    this.channels = [];
    this.selectedChannels = [];
    this.displayMode = 'time';
  }

  // ── File loading ─────────────────────────────────────────────────
  async onFileSelect(event: any): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) { alert('Please select a file'); return; }

    const file = files[0];
    this.selectedFile = file.name;
    const extension = file.name.split('.').pop()?.toLowerCase();

    const EEG_EXTENSIONS = ['npy', 'set', 'edf', 'bdf'];
    const ECG_EXTENSIONS = ['mat', 'dat', 'hea', 'csv'];

    let endpoint: string;
    if (EEG_EXTENSIONS.includes(extension)) {
      endpoint = 'http://127.0.0.1:8000/converteegtojsonandclassify';
    } else if (ECG_EXTENSIONS.includes(extension)) {
      endpoint = 'http://127.0.0.1:8000/convertecgtojsonandclassify';
    } else {
      alert(`Unsupported file type: .${extension}`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData['message'] || 'Failed to process file'}`);
        return;
      }

      const responseDTO = await response.json();
      const data: SignalData = responseDTO.data;

      if (!data.signals || !data.channels || !data.fs) {
        alert('Invalid data structure received from server');
        return;
      }

      this.originalSignals      = data.signals || [];
      this.fullSignals          = this.originalSignals.slice();
      this.channels             = data.channels || [];
      this.originalFs           = data.fs || 500;
      this.displayFs            = this.originalFs;
      this.reoccurrenceChX      = 0;
      this.reoccurrenceChY      = this.channels.length > 1 ? 1 : 0;

      this.selectedChannels = this.channelMode === 'single'
        ? this.channels.map((_, i) => i === 0)
        : this.channels.map(() => false);

      this.diagnosis  = responseDTO.diagnosis;
      this.confidence = responseDTO.confidence;
      if (ECG_EXTENSIONS.includes(extension)) {
        this.mlDiagnosis  = responseDTO.MLDiagnosis;
        this.mlConfidence = responseDTO.MLConfidence;
      }

      this.cdr.detectChanges();

    } catch (error) {
      alert(`Error loading file: ${error}`);
    }
  }

  // ── Config — passed to child as a one-way binding ─────────────────
  //
  // IMPORTANT: only contains fields the PARENT is responsible for.
  // timeWindow / timeWindowSeconds / currentIndex are intentionally
  // omitted — the child manages those internally once booted.
  get graphConfig(): SignalGraphConfig {
    return {
      mode:                 this.displayMode,
      signals:              this.fullSignals,
      channels:             this.channels,
      fs:                   this.displayFs,
      signalType:           this.signalType,
      selectedChannels:     this.selectedChannels,
      // These seed the child on first load only; after that the child owns them.
      currentIndex:         0,
      timeWindow:           Math.round(2 * this.displayFs),
      timeWindowSeconds:    2,
      polarMode:            this.polarMode,
      reoccurrenceChX:      this.reoccurrenceChX,
      reoccurrenceChY:      this.reoccurrenceChY,
      reoccurrenceColorMap: this.reoccurrenceColorMap,
    };
  }

  // ── Display mode ─────────────────────────────────────────────────
  setDisplayMode(mode: 'time' | 'reoccurrence' | 'polar' | 'xor'): void {
    this.displayMode = mode;
    this.cdr.detectChanges();
  }

  // ── Reoccurrence channel selectors ───────────────────────────────
  onReoccurrenceChannelChange(axis: 'x' | 'y', value: number): void {
    if (axis === 'x') this.reoccurrenceChX = value;
    else              this.reoccurrenceChY = value;
    this.cdr.detectChanges();
  }

  getSelectedSingleChannel(): number | null {
  const idx = this.selectedChannels.findIndex(c => c);
  return idx === -1 ? null : idx;
}

  // ── Channel toggles ──────────────────────────────────────────────
  onChannelToggle(index: number): void {
    if (this.channelMode === 'single') {
      this.selectedChannels = this.selectedChannels.map((_, i) => i === index);
    } else {
      this.selectedChannels[index] = !this.selectedChannels[index];
      // Trigger immutability so Angular's OnPush picks it up if ever switched
      this.selectedChannels = [...this.selectedChannels];
    }
    this.cdr.detectChanges();
  }

  onSingleChannelChange(channelIndex: number): void {
    this.selectedChannels = this.selectedChannels.map((_, i) => i === channelIndex);
    this.cdr.detectChanges();
  }

  hasSelectedChannels(): boolean {
    return this.selectedChannels.some(c => c);
  }

  // ── Receive state back from the child (optional — for syncing UI) ─
  onPlaybackChange(e: { isPaused: boolean; currentIndex: number; timeWindowSeconds: number; playbackSpeed: number }): void {
    // No-op by default. Add logic here only if the parent template
    // needs to display playback state (e.g. a status bar outside the graph).
  }
}