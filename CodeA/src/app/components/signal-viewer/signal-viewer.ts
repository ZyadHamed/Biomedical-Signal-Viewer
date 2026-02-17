import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
declare const Plotly: any;

interface SignalData {
  signals: number[][];
  channels: string[];
  fs: number;
}

@Component({
  selector: 'app-signal-viewer',
  standalone: true,
  imports: [CommonModule, DopplerComponent],
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

  // Channel selection - START WITH ALL UNCHECKED
  selectedChannels: boolean[] = [];

  // Timer
  private timer: any = null;

  // Colors
  private readonly COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#27ae60',
    '#2980b9', '#8e44ad'
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopScrolling();
  }

  selectSignalType(type: string): void {
    this.signalType = type;
    if (type === 'doppler') {
      this.step = 3; // doppler skips channel mode step
    } else {
      this.step = 2;
    }
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
    const el = document.getElementById('signal-graph');
    if (el && typeof Plotly !== 'undefined') {
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

    const reader = new FileReader();

    reader.onerror = () => {
      alert('Error reading file');
    };

    reader.onload = (e: any) => {
      try {
        const data: SignalData = JSON.parse(e.target.result);

        if (!data.signals || !data.channels || !data.fs) {
          throw new Error('Invalid JSON structure. Need: signals, channels, fs');
        }

        this.originalSignals = data.signals || [];
        this.fullSignals = this.originalSignals.slice();
        this.channels = data.channels || [];
        this.originalFs = data.fs || 500;
        this.displayFs = this.originalFs;

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

  plotSignals(): void {
    if (typeof Plotly === 'undefined') {
      setTimeout(() => this.plotSignals(), 100);
      return;
    }
    if (!this.fullSignals.length) return;

    // Route to the correct drawing function based on selected mode
    if (this.displayMode === 'reoccurrence') {
      this.plotReoccurrenceMap();
      return;
    }
    if (this.displayMode === 'polar') {
      this.plotPolarGraph();
      return;
    }
    if (this.displayMode === 'xor') {
      this.plotXorGraph();
      return;
    }
    // --- Original Time-Domain Plotting Logic ---
    const traces: any[] = [];

    const checked = this.selectedChannels
      .map((selected, index) => selected ? index : -1)
      .filter(index => index !== -1);

    if (!checked.length) {
      const el = document.getElementById('signal-graph');
      if (el && typeof Plotly !== 'undefined') Plotly.purge('signal-graph');
      return;
    }

    const visibleEnd = Math.min(
      this.currentIndex + this.timeWindow,
      this.fullSignals.length
    );

    const CHANNEL_SPACING = 3;

    checked.forEach((chIdx, stackIdx) => {
      const segment = this.fullSignals
        .slice(this.currentIndex, visibleEnd)
        .map(row => row[chIdx]);

      const xTime = segment.map((_, i) =>
        (this.currentIndex + i) / this.displayFs
      );

      const minVal = Math.min(...segment);
      const maxVal = Math.max(...segment);
      const range = maxVal - minVal || 1;

      const yData = segment.map(val => {
        const normalized = (val - minVal) / range;
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
        hovertemplate: `${this.channels[chIdx]}<br>Time: %{x:.3f}s<extra></extra>`
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
      height: 300 + (checked.length * 120),
      margin: { l: 60, r: 150, t: 80, b: 60 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#f8f9fa'
    };

    Plotly.react('signal-graph', traces, layout, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  plotReoccurrenceMap(): void {
    const chX = this.reoccurrenceChX;
    const chY = this.reoccurrenceChY;

    if (!this.channels.length || chX === undefined || chY === undefined) return;

    const visibleEnd = Math.min(this.currentIndex + this.timeWindow, this.fullSignals.length);

    const xData = this.fullSignals.slice(0, visibleEnd).map(row => row[chX]);
    const yData = this.fullSignals.slice(0, visibleEnd).map(row => row[chY]);

    // إنشاء مصفوفة تعبر عن الزمن عشان نلون بيها النقط (الأقدم لون والأحدث لون)
    const timeIndices = xData.map((_, i) => i);

    const trace = {
      x: xData,
      y: yData,
      type: 'scatter',
      mode: 'markers',
      name: `${this.channels[chX]} vs ${this.channels[chY]}`,
      marker: {
        color: timeIndices, // اللون يعتمد على الزمن (Intensity map)
        colorscale: this.reoccurrenceColorMap, // تطبيق الـ Color map اللي المستخدم اختاره
        showscale: true, // إظهار مسطرة الألوان جنب الرسمة
        size: 5,
        opacity: 0.7
      },
      hovertemplate: `X (${this.channels[chX]}): %{x:.3f}<br>Y (${this.channels[chY]}): %{y:.3f}<extra></extra>`
    };

    const layout = {
      title: { text: `Reoccurrence Map: ${this.channels[chX]} vs ${this.channels[chY]}`, font: { size: 20, color: '#1e3c72' } },
      xaxis: { title: `${this.channels[chX]} Amplitude`, gridcolor: '#e0e0e0' },
      yaxis: { title: `${this.channels[chY]} Amplitude`, gridcolor: '#f0f0f0' },
      showlegend: false,
      height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#f8f9fa',
      hovermode: 'closest'
    };

    Plotly.react('signal-graph', [trace], layout, { responsive: true, displayModeBar: true, displaylogo: false });
  }
  // NEW: Function to plot the Polar Graph
  plotPolarGraph(): void {
    const checked = this.selectedChannels
      .map((selected, index) => selected ? index : -1)
      .filter(index => index !== -1);

    if (!checked.length) {
      if (typeof Plotly !== 'undefined') Plotly.purge('signal-graph');
      return;
    }

    // تحديد نقطة البداية بناءً على المود (ثابت ولا تراكمي)
    const isCumulative = this.polarMode === 'cumulative';
    const startIndex = isCumulative ? 0 : this.currentIndex;
    const visibleEnd = Math.min(this.currentIndex + this.timeWindow, this.fullSignals.length);

    const traces: any[] = [];

    checked.forEach((chIdx) => {
      const segment = this.fullSignals.slice(startIndex, visibleEnd).map(row => row[chIdx]);

      const theta = segment.map((_, i) => {
        // حساب الزمن الفعلي للنقطة
        const actualIndex = isCumulative ? i : (this.currentIndex + i);
        const timeInSeconds = actualIndex / this.displayFs;
        // تحويل الزمن لزاوية بتلف 360 درجة كل Time Window
        return ((timeInSeconds % this.timeWindowSeconds) / this.timeWindowSeconds) * 360;
      });

      traces.push({
        type: 'scatterpolar',
        mode: 'lines',
        r: segment,      // r = magnitude
        theta: theta,    // theta = time
        name: this.channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 },
        hovertemplate: `${this.channels[chIdx]}<br>Time: %{theta:.1f}°<br>Amp: %{r:.3f}<extra></extra>`
      });
    });

    const layout = {
      title: { text: `Polar Graph (${isCumulative ? 'Cumulative' : 'Fixed Time'})`, font: { size: 20, color: '#1e3c72' } },
      polar: {
        radialaxis: { visible: true, gridcolor: '#e0e0e0' },
        angularaxis: { direction: 'clockwise', gridcolor: '#e0e0e0' }
      },
      showlegend: true,
      height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: 'transparent',
    };

    Plotly.react('signal-graph', traces, layout, { responsive: true, displayModeBar: true, displaylogo: false });
  }
  // NEW: Function to plot XOR Graph (Chunk by Chunk)
  plotXorGraph(): void {
    const checked = this.selectedChannels
      .map((selected, index) => selected ? index : -1)
      .filter(index => index !== -1);

    if (!checked.length) {
      if (typeof Plotly !== 'undefined') Plotly.purge('signal-graph');
      return;
    }

    const chunkSize = this.timeWindow; // حجم الـ Chunk هو الـ Window
    const visibleEnd = Math.min(this.currentIndex + chunkSize, this.fullSignals.length);
    const scale = 1000; // عشان نحافظ على دقة الكسور أثناء الـ XOR

    const traces: any[] = [];

    checked.forEach((chIdx) => {
      // مصفوفة هنخزن فيها ناتج الـ XOR النهائي طولها نفس طول الـ Window
      const xorResult = new Array(chunkSize).fill(0);
      let isFirstChunk = true;

      // بنمشي على الإشارة ونقسمها لـ Chunks
      for (let start = 0; start < visibleEnd; start += chunkSize) {
        const end = Math.min(start + chunkSize, visibleEnd);
        const chunk = this.fullSignals.slice(start, end).map(row => row[chIdx]);

        for (let i = 0; i < chunk.length; i++) {
          if (isFirstChunk) {
            xorResult[i] = chunk[i]; // أول Chunk بينزل زي ما هو
          } else {
            // بنعمل XOR للـ Chunk الجديد مع الناتج المتراكم
            const intA = Math.round(xorResult[i] * scale);
            const intB = Math.round(chunk[i] * scale);
            xorResult[i] = (intA ^ intB) / scale;
          }
        }
        isFirstChunk = false;
      }

      // تحويل الـ index لزمن عشان محور X
      const timeAxis = xorResult.map((_, i) => i / this.displayFs);

      traces.push({
        x: timeAxis,
        y: xorResult,
        type: 'scatter',
        mode: 'lines',
        name: this.channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 },
        hovertemplate: `${this.channels[chIdx]}<br>Time: %{x:.3f}s<br>XOR Amp: %{y:.3f}<extra></extra>`
      });
    });

    const layout = {
      title: { text: `XOR Cumulative Graph (Chunk = ${this.timeWindowSeconds}s)`, font: { size: 20, color: '#1e3c72' } },
      xaxis: { title: 'Time (seconds)', gridcolor: '#e0e0e0' },
      yaxis: { title: 'XOR Amplitude', gridcolor: '#e0e0e0' },
      showlegend: true,
      height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: 'transparent',
    };

    Plotly.react('signal-graph', traces, layout, { responsive: true, displayModeBar: true, displaylogo: false });
  }
  startScrolling(): void {
    this.stopScrolling();
    this.timer = setInterval(() => {
      if (this.isPaused || !this.fullSignals.length) return;
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

  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }

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
    if (!this.timer) this.startScrolling();
  }

  getMaxTimeWindow(): number {
    if (!this.fullSignals.length) return 10;
    return Math.min(10, this.fullSignals.length / this.displayFs);
  }

  hasSelectedChannels(): boolean {
    return this.selectedChannels.some(c => c);
  }
}