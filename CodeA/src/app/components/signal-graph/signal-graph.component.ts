import {
  Component, Input, OnChanges, OnDestroy,
  SimpleChanges, ViewEncapsulation, ElementRef, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

declare const Plotly: any;

export type DisplayMode = 'time' | 'reoccurrence' | 'polar' | 'xor';

export interface SignalGraphConfig {
  mode: DisplayMode;
  signals: number[][];
  channels: string[];
  fs: number;
  signalType: string;
  

  // Time / Polar / XOR
  selectedChannels: boolean[];
  currentIndex: number;
  timeWindow: number;
  timeWindowSeconds: number;

  // Polar
  polarMode: 'fixed' | 'cumulative';

  // Reoccurrence
  reoccurrenceChX: number;
  reoccurrenceChY: number;
  reoccurrenceColorMap: string;
}

@Component({
  selector: 'app-signal-graph',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="graph-container">
      @if (!config || !config.signals.length) {
        <div class="empty-state">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <p class="empty-title">No Signal Loaded</p>
          <p class="empty-subtitle">Upload a JSON file to begin analysis</p>
        </div>
      }

      @if (config?.signals?.length && config?.mode === 'time' && !hasSelectedChannels()) {
        <div class="empty-state">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none"
               stroke="#4CAF50" stroke-width="1.5" opacity="0.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <p class="empty-title success">Signal Loaded Successfully</p>
          <p class="empty-subtitle">Select channels above to display waveforms</p>
        </div>
      }

      <div [id]="graphId" class="signal-graph"></div>
    </div>
  `,
})
export class SignalGraphComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() config!: SignalGraphConfig;
  @Input() xAxisLabel: string = 'Time (seconds)'; 
  @Input() graphId: string = 'signal-graph';
  private readonly COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#27ae60',
    '#2980b9', '#8e44ad'
  ];

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    if (this.config) this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    if (typeof Plotly !== 'undefined') {
      Plotly.purge(this.graphId);
    }
  }

  render(): void {
    if (typeof Plotly === 'undefined') {
      setTimeout(() => this.render(), 100);
      return;
    }
    if (!this.config?.signals.length) return;

    switch (this.config.mode) {
      case 'reoccurrence': this.plotReoccurrenceMap(); break;
      case 'polar':        this.plotPolarGraph();      break;
      case 'xor':         this.plotXorGraph();         break;
      default:            this.plotTimeDomain();       break;
    }
  }

  hasSelectedChannels(): boolean {
    return this.config?.selectedChannels?.some(c => c) ?? false;
  }

  private getCheckedIndices(): number[] {
    return this.config.selectedChannels
      .map((selected, i) => selected ? i : -1)
      .filter(i => i !== -1);
  }

  private plotTimeDomain(): void {
    const { signals, channels, fs, signalType, currentIndex, timeWindow } = this.config;
    const checked = this.getCheckedIndices();

    if (!checked.length) {
      Plotly.purge(this.graphId);
      return;
    }

    const visibleEnd = Math.min(currentIndex + timeWindow, signals.length);
    const CHANNEL_SPACING = 3;
    const traces: any[] = [];

    checked.forEach((chIdx, stackIdx) => {
      const segment = signals.slice(currentIndex, visibleEnd).map(row => row[chIdx]);
      const xTime = segment.map((_, i) => (currentIndex + i) / fs);

      const minVal = Math.min(...segment);
      const maxVal = Math.max(...segment);
      const range = maxVal - minVal || 1;
      const yData = segment.map(val =>
        ((val - minVal) / range) + (stackIdx * CHANNEL_SPACING)
      );

      traces.push({
        x: xTime, y: yData,
        type: 'scatter', mode: 'lines',
        name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 },
        hovertemplate: `${channels[chIdx]}<br>${this.xAxisLabel}: %{x:.3f}<br>Value: %{y:.3f}<extra></extra>`
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `${signalType.toUpperCase()} Signal Viewer - ${checked.length} Channel(s)`, font: { size: 20, color: '#002b5c' } },
      xaxis: { title: this.xAxisLabel, range: [currentIndex / fs, (visibleEnd - 1) / fs], gridcolor: '#e0e0e0' },
      yaxis: { 
              tickvals: checked.map((_, i) => i * CHANNEL_SPACING + 0.5),
              showticklabels: true, 
              gridcolor: '#f0f0f0' 
              },
      showlegend: true,
      legend: { orientation: 'v', x: 1.02, y: 1, font: { size: 12 } },
      height: 300 + (checked.length * 120),
      margin: { l: 60, r: 150, t: 80, b: 60 },
      plot_bgcolor: '#ffffff', paper_bgcolor: '#f8f9fa'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  private plotReoccurrenceMap(): void {
    const { signals, channels, currentIndex, timeWindow, reoccurrenceChX, reoccurrenceChY, reoccurrenceColorMap } = this.config;
    const visibleEnd = Math.min(currentIndex + timeWindow, signals.length);

    const xData = signals.slice(0, visibleEnd).map(row => row[reoccurrenceChX]);
    const yData = signals.slice(0, visibleEnd).map(row => row[reoccurrenceChY]);

    Plotly.react(this.graphId, [{
      x: xData, y: yData,
      type: 'scatter', mode: 'markers',
      marker: {
        color: xData.map((_, i) => i),
        colorscale: reoccurrenceColorMap,
        showscale: true, size: 5, opacity: 0.7
      },
      hovertemplate: `X (${channels[reoccurrenceChX]}): %{x:.3f}<br>Y (${channels[reoccurrenceChY]}): %{y:.3f}<extra></extra>`
    }], {
      title: { text: `Reoccurrence Map: ${channels[reoccurrenceChX]} vs ${channels[reoccurrenceChY]}`, font: { size: 20, color: '#1e3c72' } },
      xaxis: { title: `${channels[reoccurrenceChX]} Amplitude`, gridcolor: '#e0e0e0' },
      yaxis: { title: `${channels[reoccurrenceChY]} Amplitude`, gridcolor: '#f0f0f0' },
      showlegend: false, height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff', paper_bgcolor: '#f8f9fa'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  private plotPolarGraph(): void {
    const { signals, channels, fs, currentIndex, timeWindow, timeWindowSeconds, polarMode } = this.config;
    const checked = this.getCheckedIndices();
    if (!checked.length) { Plotly.purge(this.graphId); return; }

    const isCumulative = polarMode === 'cumulative';
    const startIndex = isCumulative ? 0 : currentIndex;
    const visibleEnd = Math.min(currentIndex + timeWindow, signals.length);
    const traces: any[] = [];

    checked.forEach(chIdx => {
      const segment = signals.slice(startIndex, visibleEnd).map(row => row[chIdx]);
      const theta = segment.map((_, i) => {
        const t = isCumulative ? i : (currentIndex + i);
        return ((t / fs % timeWindowSeconds) / timeWindowSeconds) * 360;
      });

      traces.push({
        type: 'scatterpolar', mode: 'lines',
        r: segment, theta,
        name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 }
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `Polar Graph (${isCumulative ? 'Cumulative' : 'Fixed Time'})`, font: { size: 20, color: '#1e3c72' } },
      polar: {
        radialaxis: { visible: true, gridcolor: '#e0e0e0' },
        angularaxis: { direction: 'clockwise', gridcolor: '#e0e0e0' }
      },
      showlegend: true, height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff', paper_bgcolor: 'transparent'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  private plotXorGraph(): void {
    const { signals, channels, fs, currentIndex, timeWindow, timeWindowSeconds } = this.config;
    const checked = this.getCheckedIndices();
    if (!checked.length) { Plotly.purge(this.graphId); return; }

    const visibleEnd = Math.min(currentIndex + timeWindow, signals.length);
    const scale = 1000;
    const traces: any[] = [];

    checked.forEach(chIdx => {
      const xorResult = new Array(timeWindow).fill(0);
      let isFirst = true;

      for (let start = 0; start < visibleEnd; start += timeWindow) {
        const chunk = signals.slice(start, Math.min(start + timeWindow, visibleEnd)).map(row => row[chIdx]);
        chunk.forEach((val, i) => {
          xorResult[i] = isFirst ? val : ((Math.round(xorResult[i] * scale) ^ Math.round(val * scale)) / scale);
        });
        isFirst = false;
      }

      traces.push({
        x: xorResult.map((_, i) => i / fs),
        y: xorResult,
        type: 'scatter', mode: 'lines',
        name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 }
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `XOR Cumulative Graph (Chunk = ${timeWindowSeconds}s)`, font: { size: 20, color: '#1e3c72' } },
      xaxis: { title: 'Time (seconds)', gridcolor: '#e0e0e0' },
      yaxis: { title: 'XOR Amplitude', gridcolor: '#e0e0e0' },
      showlegend: true, height: 550,
      margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff', paper_bgcolor: 'transparent'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }
}