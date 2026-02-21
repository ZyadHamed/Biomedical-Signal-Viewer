import { Component, OnInit, OnDestroy, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DopplerComponent } from '../doppler/doppler';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Microbiome } from "../microbiome/microbiome";
import { DroneDetectoromponent } from "../DroneDetector/DroneDetector";
import { SignalGraphComponent, SignalGraphConfig } from '../signal-graph/signal-graph.component';

interface SignalData {
  signals: number[][];
  channels: string[];
  fs: number;
}

@Component({
  selector: 'app-signal-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, DopplerComponent, Microbiome, DroneDetectoromponent, SignalGraphComponent],
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

  // NEW: Display Mode State (Time Domain vs Reoccurrence,polar and xor Maps)
  displayMode: 'time' | 'reoccurrence' | 'polar' | 'xor' = 'time';

  // NEW: Polar Plot Controls
  polarMode: 'fixed' | 'cumulative' = 'fixed';

  // NEW: Reoccurrence Color Map Controls
  reoccurrenceColorMap: string = 'Viridis';

  colorMapOptions: string[] = ['Viridis', 'Plasma', 'Inferno', 'Jet', 'Hot', 'Blues', 'Electric'];
  // NEW: Reoccurrence Map selections
  reoccurrenceChX: number = 0;
  reoccurrenceChY: number = 0;

  // Signal data
  originalSignals: number[][] = [];
  fullSignals: number[][] = [];
  channels: string[] = [];
  originalFs: number = 500;
  displayFs: number = 500;

  // Display settings
  currentIndex: number = 0;
  timeWindow: number = 1000;
  timeWindowSeconds: number = 2;
  isPaused: boolean = false;

  // Playback speed multiplier
  playbackSpeed: number = 1;

  // Channel selection
  selectedChannels: boolean[] = [];

  // Timer
  private timer: any = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.stopScrolling();
  }

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
      if (this.step === 1) {
        this.signalType = '';
        this.channelMode = '';
        this.resetData();
      }
      if (this.step === 2) {
        this.channelMode = '';
        this.resetData();
      }
      this.cdr.detectChanges();
    }
  }

  resetData(): void {
    this.stopScrolling();
    this.originalSignals = [];
    this.fullSignals = [];
    this.channels = [];
    this.selectedChannels = [];
    this.currentIndex = 0;
    this.displayMode = 'time'; // Reset display mode
  }

  async onFileSelect(event: any): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) {
      alert('Please select a file');
      return;
    }

    const file = files[0];

    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Please upload a .json file');
      return;
    }

    const reader = new FileReader();

    reader.onerror = (error) => {
      alert('Error reading file');
    };

    reader.onload = (e: any) => {
      try {
        const data: SignalData = JSON.parse(e.target.result);

        if (!data.signals || !data.channels || !data.fs) {
          throw new Error('Invalid JSON structure');
        }

        this.originalSignals = data.signals || [];
        this.fullSignals = this.originalSignals.slice();
        this.channels = data.channels || [];
        this.originalFs = data.fs || 500;
        this.displayFs = this.originalFs;
        // NEW: Set default channels for Reoccurrence map
        this.reoccurrenceChX = 0;
        this.reoccurrenceChY = this.channels.length > 1 ? 1 : 0;
        if (this.channelMode === 'single') {
          this.selectedChannels = this.channels.map((_, i) => i === 0);
          setTimeout(() => {
            this.plotSignals();
            this.startScrolling();
          }, 100);
        } else {
          this.selectedChannels = this.channels.map(() => false);
        }

        const maxSeconds = Math.min(10, this.fullSignals.length / this.displayFs);
        this.timeWindowSeconds = Math.min(2, maxSeconds);
        this.timeWindow = Math.round(this.timeWindowSeconds * this.displayFs);
        this.currentIndex = 0;
        this.cdr.detectChanges();
      } catch (error) {
        alert(`Error loading file: ${error}`);
      }
    };
    reader.readAsText(file);
  }

  plotSignals() : void{
    if (this.signalGraph) {
      this.signalGraph.config = this.graphConfig;
      this.signalGraph.render();
    }
  }
  // NEW: Method to toggle between modes
  setDisplayMode(mode: 'time' | 'reoccurrence' | 'polar' | 'xor'): void {
    this.displayMode = mode;
    this.plotSignals();
    if (!this.timer) {
      this.startScrolling();
    }
    this.cdr.detectChanges();
  }

  // NEW: Method to handle X and Y channel selection for Reoccurrence Map
  onReoccurrenceChannelChange(axis: 'x' | 'y', event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const index = +selectElement.value;
    if (axis === 'x') this.reoccurrenceChX = index;
    if (axis === 'y') this.reoccurrenceChY = index;
    this.plotSignals();
  }


  get graphConfig(): SignalGraphConfig {
  return {
    mode:                 this.displayMode,
    signals:              this.fullSignals,
    channels:             this.channels,
    fs:                   this.displayFs,
    signalType:           this.signalType,
    selectedChannels:     this.selectedChannels,
    currentIndex:         this.currentIndex,
    timeWindow:           this.timeWindow,
    timeWindowSeconds:    this.timeWindowSeconds,
    polarMode:            this.polarMode,
    reoccurrenceChX:      this.reoccurrenceChX,
    reoccurrenceChY:      this.reoccurrenceChY,
    reoccurrenceColorMap: this.reoccurrenceColorMap,
  };
}

startScrolling(): void {
  this.stopScrolling();

  this.timer = setInterval(() => {
    if (this.isPaused || !this.fullSignals.length) return;
    if (this.displayMode === 'time' && !this.selectedChannels.some(c => c)) return;

    this.currentIndex += Math.round(10 * this.playbackSpeed);

    if (this.currentIndex + this.timeWindow >= this.fullSignals.length) {
      this.currentIndex = 0;
    }
      if (this.signalGraph) {
    this.signalGraph.config = this.graphConfig;
    this.signalGraph.render();
  }
  }, 50);
}
  stopScrolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }
  // Update playback speed
  setPlaybackSpeed(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.playbackSpeed = parseFloat(selectElement.value);
  }
  onTimeWindowChange(event: any): void {
    const seconds = parseFloat(event.target.value);
    this.timeWindowSeconds = seconds;
    this.timeWindow = Math.round(seconds * this.displayFs);
    this.plotSignals();
  }

  onChannelToggle(index: number): void {
    if (this.channelMode === 'single') {
      this.selectedChannels = this.selectedChannels.map((_, i) => i === index);
    } else {
      this.selectedChannels[index] = !this.selectedChannels[index];
    }

    if (this.selectedChannels.some(c => c) && !this.timer) {
      this.plotSignals();
      this.startScrolling();
    } else {
      this.plotSignals();
    }
  }

  onSingleChannelChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const channelIndex = +selectElement.value;

    this.selectedChannels = this.selectedChannels.map(() => false);
    this.selectedChannels[channelIndex] = true;

    this.plotSignals();
    if (!this.timer) {
      this.startScrolling();
    }
  }

  getMaxTimeWindow(): number {
    if (!this.fullSignals.length) return 10;
    return Math.min(10, this.fullSignals.length / this.displayFs);
  }

  hasSelectedChannels(): boolean {
    return this.selectedChannels.some(c => c);
  }
  
}

