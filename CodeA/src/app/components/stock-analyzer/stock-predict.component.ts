import {
  Component, OnDestroy, AfterViewInit,
  ViewEncapsulation, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpEventType } from '@angular/common/http';
import { SignalGraphComponent, SignalGraphConfig } from '../signal-graph/signal-graph.component';

declare const Plotly: any;

interface StockSignalData {
  signals: number[][];
  channels: string[];
  fs: number;
}

interface PredictResponse {
  original: StockSignalData;
  forecast: StockSignalData;
}

@Component({
  selector: 'app-stock-predict',
  standalone: true,
  imports: [CommonModule, HttpClientModule, SignalGraphComponent],
  templateUrl: 'stock-predict.component.html',
  styleUrl: 'stock-predict.component.css',
  encapsulation: ViewEncapsulation.None
})
export class StockPredictComponent implements OnDestroy, AfterViewInit {

  /* ── State ── */
  selectedFile: File | null = null;
  isLoading = false;
  isDragging = false;
  uploadProgress = 0;
  error: string | null = null;
  response: PredictResponse | null = null;
  activeTab: 'line' | 'candle' = 'line';

  /* ── Derived data ── */
  lastOriginal: number[] = [];
  forecastDelta: number[] = [];

  /* ── Graph configs ── */
  originalConfig: SignalGraphConfig | null = null;
  forecastConfig: SignalGraphConfig | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (typeof Plotly !== 'undefined') {
      ['sp-original-graph', 'sp-forecast-graph',
       'sp-candle-original', 'sp-candle-forecast'].forEach(id => {
        const el = document.getElementById(id);
        if (el) Plotly.purge(el);
      });
    }
  }

  /* ── File picking ── */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }

  private setFile(file: File): void {
    this.selectedFile = file;
    this.error = null;
    this.response = null;
    this.originalConfig = null;
    this.forecastConfig = null;
  }

  /* ── Upload ── */
  upload(): void {
    if (!this.selectedFile) return;
    this.isLoading = true;
    this.error = null;
    this.uploadProgress = 10;

    const form = new FormData();
    form.append('file', this.selectedFile);

    this.http.post<PredictResponse>('http://127.0.0.1:8000/predictstock', form, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round((event.loaded / event.total) * 70) + 10;
        } else if (event.type === HttpEventType.Response) {
          this.uploadProgress = 100;
          this.response = event.body!;
          this.processResponse();
          this.isLoading = false;
          this.cdr.detectChanges();
          setTimeout(() => {
            if (this.activeTab === 'candle') this.renderCandleCharts();
          }, 50);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.uploadProgress = 0;
        this.error =
          err?.error?.['message:'] ??
          err?.message ??
          'Server error. Please try again.';
      }
    });
  }

  /* ── Build configs & derived KPIs ── */
  private processResponse(): void {
    const { original, forecast } = this.response!;

    this.lastOriginal = original.channels.map((_, i) =>
      original.signals[original.signals.length - 1]?.[i] ?? 0
    );
    this.forecastDelta = original.channels.map((_, i) =>
      (forecast.signals[0]?.[i] ?? 0) - this.lastOriginal[i]
    );

    const buildConfig = (data: StockSignalData, label: string): SignalGraphConfig => ({
      mode: 'time',
      signals: data.signals,
      channels: data.channels,
      fs: data.fs,
      signalType: label,
      selectedChannels: new Array(data.channels.length).fill(true),
      currentIndex: 0,
      timeWindow: data.signals.length,
      timeWindowSeconds: data.signals.length / data.fs,
      polarMode: 'fixed',
      reoccurrenceChX: 0,
      reoccurrenceChY: 1,
      reoccurrenceColorMap: 'Viridis'
    });

    this.originalConfig = buildConfig(original, 'Stock');
    this.forecastConfig = buildConfig(forecast, 'Forecast');
  }

  /* ── Tab switch ── */
  setTab(tab: 'line' | 'candle'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
    if (tab === 'candle') {
      setTimeout(() => this.renderCandleCharts(), 80);
    }
  }

  /* ── Candlestick rendering ── */
  private renderCandleCharts(): void {
    if (!this.response || typeof Plotly === 'undefined') return;
    this.renderSingleCandle('sp-candle-original', this.response.original, 'Original OHLC');
    this.renderSingleCandle('sp-candle-forecast', this.response.forecast, 'Forecasted OHLC');
  }

  private renderSingleCandle(elementId: string, data: StockSignalData, title: string): void {
    const el = document.getElementById(elementId);
    if (!el) return;

    const ch = data.channels;
    const openIdx  = ch.findIndex(c => c.toLowerCase() === 'open');
    const highIdx  = ch.findIndex(c => c.toLowerCase() === 'high');
    const lowIdx   = ch.findIndex(c => c.toLowerCase() === 'low');
    const closeIdx = ch.findIndex(c => c.toLowerCase() === 'close');

    if ([openIdx, highIdx, lowIdx, closeIdx].some(i => i === -1)) return;

    Plotly.react(el, [{
      type: 'candlestick',
      x: data.signals.map((_, i) => i + 1),
      open:  data.signals.map(r => r[openIdx]),
      high:  data.signals.map(r => r[highIdx]),
      low:   data.signals.map(r => r[lowIdx]),
      close: data.signals.map(r => r[closeIdx]),
      increasing: { line: { color: '#1a8a4a', width: 1.5 }, fillcolor: 'rgba(26,138,74,0.75)' },
      decreasing: { line: { color: '#c0392b', width: 1.5 }, fillcolor: 'rgba(192,57,43,0.75)' },
      whiskerwidth: 0.3
    }], {
      title: { text: title, font: { size: 18, color: '#002b5c' } },
      xaxis: {
        title: 'Sample Index',
        rangeslider: { visible: true, thickness: 0.05 },
        gridcolor: '#e8eef6',
        linecolor: '#c8d8f0',
        tickfont: { color: '#4a6080' }
      },
      yaxis: {
        title: 'Price',
        gridcolor: '#e8eef6',
        linecolor: '#c8d8f0',
        tickformat: '.2f',
        tickfont: { color: '#4a6080' }
      },
      height: 420,
      margin: { l: 70, r: 30, t: 60, b: 60 },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#f8faff',
      showlegend: false
    }, {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d']
    });
  }
}