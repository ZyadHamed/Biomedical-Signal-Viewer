import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare const Plotly: any;

interface SignalData {
  signals: number[][];
  channels: string[];
  fs: number;
}

@Component({
  selector: 'app-signal-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './signal-viewer.html',
  styleUrls: ['./signal-viewer.css']
})
export class SignalViewerComponent implements OnInit, OnDestroy {
  // Workflow state
  step: number = 1;
  signalType: string = '';
  channelMode: string = '';
  
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
  
  // Channel selection - START WITH ALL UNCHECKED!
  selectedChannels: boolean[] = [];
  
  // Timer
  private timer: any = null;
  
  // Colors
  private readonly COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
    '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#27ae60',
    '#2980b9', '#8e44ad'
  ];

  constructor() { }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.stopScrolling();
  }

  selectSignalType(type: string): void {
    this.signalType = type;
    this.step = 2;
  }

  selectChannelMode(mode: string): void {
    this.channelMode = mode;
    this.step = 3;
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
    }
  }

  resetData(): void {
    this.stopScrolling();
    this.originalSignals = [];
    this.fullSignals = [];
    this.channels = [];
    this.selectedChannels = [];
    this.currentIndex = 0;
    if (typeof Plotly !== 'undefined') {
      Plotly.purge('signal-graph');
    }
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

  console.log('File selected:', file.name);

  const reader = new FileReader();

  reader.onerror = (error) => {
    console.error('FileReader error:', error);
    alert('Error reading file');
  };

  reader.onload = (e: any) => {
    console.log('FileReader onload triggered!');
    
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
      
      console.log(`Loaded ${this.fullSignals.length} samples, ${this.channels.length} channels, ${this.originalFs} Hz`);
      
      // IMPORTANT: Start with ALL channels UNCHECKED (except single mode)
      if (this.channelMode === 'single') {
        // In single mode, select first channel by default
        this.selectedChannels = this.channels.map((_, i) => i === 0);
        console.log('Single mode - auto-selected first channel');
        // Plot immediately
        setTimeout(() => {
          this.plotSignals();
          this.startScrolling();
        }, 100);
      } else {
        // In multi mode, start with all unchecked
        this.selectedChannels = this.channels.map(() => false);
        console.log('Multi mode - all channels unchecked');
      }
      
      const maxSeconds = Math.min(10, this.fullSignals.length / this.displayFs);
      this.timeWindowSeconds = Math.min(2, maxSeconds);
      this.timeWindow = Math.round(this.timeWindowSeconds * this.displayFs);
      
      this.currentIndex = 0;
      
      console.log('=== FILE LOADED SUCCESSFULLY ===');
      console.log('Channels:', this.channels);
      console.log('Selected channels:', this.selectedChannels);

      console.log(this.hasSelectedChannels());

      
    } catch (error) {
      console.error('Error parsing file:', error);
      alert(`Error loading file: ${error}`);
    }
  };

  console.log('Starting to read file...');
  reader.readAsText(file);
}

  // FIXED: Much better vertical stacking with proper spacing
  plotSignals(): void {
    if (typeof Plotly === 'undefined') {
    console.error('Plotly is not loaded yet! Retrying...');
    setTimeout(() => this.plotSignals(), 100);
    return;
  }
    if (!this.fullSignals.length) {
      return;
    }

    const traces: any[] = [];
    
    const checked = this.selectedChannels
      .map((selected, index) => selected ? index : -1)
      .filter(index => index !== -1);

    if (!checked.length) {
      if (typeof Plotly !== 'undefined') {
        Plotly.purge('signal-graph');
      }
      return;
    }

    const visibleEnd = Math.min(
      this.currentIndex + this.timeWindow,
      this.fullSignals.length
    );

    // IMPROVED: Better vertical spacing between channels
    const CHANNEL_SPACING = 3;  // Increased spacing for clearer separation
    
    checked.forEach((chIdx, stackIdx) => {
      const segment = this.fullSignals
        .slice(this.currentIndex, visibleEnd)
        .map(row => row[chIdx]);
      
      const xTime = segment.map((_, i) => 
        (this.currentIndex + i) / this.displayFs
      );

      // FIXED: Better normalization - preserve ECG waveform shape
      const minVal = Math.min(...segment);
      const maxVal = Math.max(...segment);
      const range = maxVal - minVal || 1;
      
      // Normalize to 0-1 range, then offset vertically
      // Each channel gets its own "track" separated by CHANNEL_SPACING
      const yData = segment.map(val => {
        const normalized = (val - minVal) / range;  // 0 to 1
        return normalized + (stackIdx * CHANNEL_SPACING);
      });

      traces.push({
        x: xTime,
        y: yData,
        type: 'scatter',
        mode: 'lines',
        name: this.channels[chIdx],
        line: { 
          color: this.COLORS[chIdx % this.COLORS.length], 
          width: 2
        },
        hovertemplate: `${this.channels[chIdx]}<br>Time: %{x:.3f}s<br>Value: %{y:.3f}<extra></extra>`
      });
    });

    const xStart = this.currentIndex / this.displayFs;
    const xEnd = (visibleEnd - 1) / this.displayFs;

    const layout = {
      title: {
        text: `${this.signalType.toUpperCase()} Signal Viewer - ${checked.length} Channel(s)`,
        font: { size: 20, color: '#002b5c' }
      },
      xaxis: { 
        title: 'Time (seconds)', 
        range: [xStart, xEnd],
        gridcolor: '#e0e0e0'
      },
      yaxis: { 
        title: 'Channels (Vertically Stacked)',
        showticklabels: false,
        gridcolor: '#f0f0f0'
      },
      showlegend: true,
      legend: {
        orientation: 'v',
        x: 1.02,
        y: 1,
        font: { size: 12 }
      },
      height: 300 + (checked.length * 120),  // More height per channel
      margin: { l: 60, r: 150, t: 80, b: 60 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#f8f9fa'
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false
    };

    Plotly.react('signal-graph', traces, layout, config);
  }

  startScrolling(): void {
    this.stopScrolling();
    
    this.timer = setInterval(() => {
      if (this.isPaused || !this.fullSignals.length) return;
      
      // Check if any channels are selected
      if (!this.selectedChannels.some(c => c)) return;
      
      this.currentIndex++;
      
      if (this.currentIndex + this.timeWindow >= this.fullSignals.length) {
        this.currentIndex = 0;
      }
      
      this.plotSignals();
    }, 50);
  }

  stopScrolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
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
    
    // If this is the first channel selected, start scrolling
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
// Helper method to check if any channels are selected
  hasSelectedChannels(): boolean {
    return this.selectedChannels.some(c => c);
  }
}