import {
  Component, Input, OnChanges, OnDestroy,
  SimpleChanges, ViewEncapsulation, ElementRef,
  AfterViewInit, Output, EventEmitter,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    /* ── Transport Bar ───────────────────────────────────────────── */
    .sg-transport {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 10px 18px;
      background: #f0f4f8;
      border: 1px solid #d8e2ee;
      border-bottom: none;
      border-radius: 10px 10px 0 0;
      font-family: 'IBM Plex Mono', 'Fira Code', monospace;
      font-size: 12px;
      color: #3a4a5c;
      flex-wrap: wrap;
    }

    .sg-play-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      background: #1a73e8;
      color: #fff;
      box-shadow: 0 2px 6px rgba(26,115,232,.35);
      transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
      flex-shrink: 0;
    }
    .sg-play-btn:hover { background: #1558c0; box-shadow: 0 4px 12px rgba(26,115,232,.45); transform: scale(1.06); }
    .sg-play-btn:active { transform: scale(0.96); }
    .sg-play-btn.paused { background: #34a853; box-shadow: 0 2px 6px rgba(52,168,83,.35); }
    .sg-play-btn.paused:hover { background: #2d8f47; }

    .sg-sep { width: 1px; height: 28px; background: #ccd6e0; flex-shrink: 0; }

    .sg-ctrl-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .sg-ctrl-label {
      font-size: 11px; font-weight: 600;
      letter-spacing: 0.06em; text-transform: uppercase;
      color: #7a8fa6; white-space: nowrap;
    }

    .sg-speed-select {
      appearance: none;
      background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237a8fa6'/%3E%3C/svg%3E") no-repeat right 8px center;
      border: 1px solid #c8d5e2; border-radius: 6px;
      padding: 4px 28px 4px 10px;
      font-family: inherit; font-size: 12px; color: #2c3e50;
      cursor: pointer; transition: border-color 0.15s;
    }
    .sg-speed-select:hover, .sg-speed-select:focus { border-color: #1a73e8; outline: none; }

    /* X-Scale slider */
    .sg-slider-wrap { display: flex; align-items: center; gap: 8px; }
    .sg-slider {
      -webkit-appearance: none; appearance: none;
      width: 130px; height: 4px; border-radius: 2px;
      background: linear-gradient(to right, #1a73e8 var(--pct, 50%), #c8d5e2 var(--pct, 50%));
      outline: none; cursor: pointer;
    }
    .sg-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px; height: 14px; border-radius: 50%;
      background: #1a73e8; border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(26,115,232,.4);
      transition: transform 0.12s;
    }
    .sg-slider::-webkit-slider-thumb:hover { transform: scale(1.25); }
    .sg-slider::-moz-range-thumb {
      width: 14px; height: 14px; border-radius: 50%;
      background: #1a73e8; border: 2px solid #fff;
    }
    .sg-slider-val { min-width: 36px; text-align: right; font-size: 12px; color: #1a73e8; font-weight: 700; }

    /* ── Scrub / progress bar ─────────────────────────────────────── */
    .sg-progress-wrap {
      flex: 1; min-width: 100px;
      display: flex; align-items: center; gap: 10px;
    }
    /*
     * IMPORTANT: no overflow:hidden here — the thumb sits above the track
     * and must not be clipped.
     */
    .sg-progress-track {
      flex: 1;
      height: 6px; border-radius: 3px;
      background: #d8e2ee;
      cursor: pointer;
      position: relative;
      user-select: none;
    }
    .sg-progress-fill {
      position: absolute; top: 0; left: 0;
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #1a73e8, #34a853);
      pointer-events: none;
    }
    .sg-progress-thumb {
      position: absolute;
      top: 50%; /* vertically centred on the track */
      width: 14px; height: 14px; border-radius: 50%;
      background: #1a73e8; border: 2px solid #fff;
      box-shadow: 0 1px 5px rgba(26,115,232,.55);
      /* translate(-50%) centres on the left% position; -50% Y centres on the track */
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.6;
      transition: opacity 0.15s, transform 0.15s;
      pointer-events: none;
    }
    .sg-progress-track:hover .sg-progress-thumb,
    .sg-progress-track.dragging .sg-progress-thumb {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    .sg-progress-time {
      font-size: 11px; color: #7a8fa6;
      white-space: nowrap; min-width: 100px;
    }

    /* Loop button */
    .sg-loop-btn {
      background: none; border: 1px solid #c8d5e2; border-radius: 6px;
      padding: 4px 9px; font-family: inherit; font-size: 11px;
      color: #7a8fa6; cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }
    .sg-loop-btn.active { border-color: #1a73e8; color: #1a73e8; background: #e8f0fe; }
    .sg-loop-btn:hover  { border-color: #1a73e8; color: #1a73e8; }

    /* Container */
    .graph-container {
      border: 1px solid #d8e2ee;
      border-radius: 0 0 10px 10px;
      overflow: hidden; background: #fff;
    }
    .sg-root { border-radius: 10px; overflow: visible; }

    .empty-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 60px 20px; color: #94a3b8;
    }
    .empty-title { margin: 12px 0 4px; font-size: 16px; font-weight: 600; color: #64748b; }
    .empty-title.success { color: #22c55e; }
    .empty-subtitle { margin: 0; font-size: 13px; }
    .signal-graph { width: 100%; }
  `],
  template: `
    <div class="sg-root">

      @if (config?.signals?.length) {
        <div class="sg-transport">

          <!-- Play / Pause -->
          <button class="sg-play-btn" [class.paused]="isPaused"
                  (click)="togglePlayPause()"
                  [title]="isPaused ? 'Resume' : 'Pause'">
            @if (!isPaused) {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="4" height="18" rx="1"/>
                <rect x="15" y="3" width="4" height="18" rx="1"/>
              </svg>
            } @else {
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            }
          </button>

          <!-- Scrub bar — full drag support -->
          <div class="sg-progress-wrap">
            <div class="sg-progress-track"
                 [class.dragging]="isScrubbing"
                 (mousedown)="onScrubStart($event)">
              <div class="sg-progress-fill"  [style.width.%]="progressPct"></div>
              <div class="sg-progress-thumb" [style.left.%]="progressPct"></div>
            </div>
            <span class="sg-progress-time">
              {{ currentTimeSec | number:'1.1-1' }}s&nbsp;/&nbsp;{{ totalTimeSec | number:'1.1-1' }}s
            </span>
          </div>

          <div class="sg-sep"></div>

          <!-- Speed -->
          <div class="sg-ctrl-group">
            <span class="sg-ctrl-label">Speed</span>
            <select class="sg-speed-select" [(ngModel)]="playbackSpeed" (change)="onSpeedChange()">
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
              <option value="8">8×</option>
            </select>
          </div>

          <div class="sg-sep"></div>

          <!-- X Scale -->
          <div class="sg-ctrl-group sg-slider-wrap">
            <span class="sg-ctrl-label">X&nbsp;Scale</span>
            <input type="range" class="sg-slider"
                   [min]="minWindowSec" [max]="maxWindowSec" [step]="0.1"
                   [value]="timeWindowSeconds"
                   (input)="onWindowSlider($event)"
                   [style]="sliderStyle">
            <span class="sg-slider-val">{{ timeWindowSeconds | number:'1.1-1' }}s</span>
          </div>

          <div class="sg-sep"></div>

          <!-- Loop -->
          <button class="sg-loop-btn" [class.active]="loop"
                  (click)="loop = !loop" title="Toggle loop">↻ Loop</button>

        </div>
      }

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
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none"
                 stroke="#4CAF50" stroke-width="1.5" opacity="0.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p class="empty-title success">Signal Loaded Successfully</p>
            <p class="empty-subtitle">Select channels above to display waveforms</p>
          </div>
        }
        <div [id]="graphId" class="signal-graph"></div>
      </div>

    </div>
  `,
})
export class SignalGraphComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() config!: SignalGraphConfig;
  @Input() xAxisLabel: string = 'Time (seconds)';
  @Input() graphId: string = 'signal-graph';

  @Output() playbackChange = new EventEmitter<{
    isPaused: boolean;
    currentIndex: number;
    timeWindowSeconds: number;
    playbackSpeed: number;
  }>();

  // ── State (public so template getters re-evaluate) ───────────────
  isPaused: boolean = false;
  playbackSpeed: number = 1;
  timeWindowSeconds: number = 2;
  loop: boolean = true;
  isScrubbing: boolean = false;

  // The single source of truth for the current sample position
  _currentIndex: number = 0;

  private timer: any = null;
  private _destroyed = false;
  private _scrubTrackRect: DOMRect | null = null;
  private _boundScrubMove!: (e: MouseEvent) => void;
  private _boundScrubUp!:   (e: MouseEvent) => void;

  private readonly COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#c0392b', '#27ae60',
    '#2980b9', '#8e44ad'
  ];

  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    if (this.config) this.boot();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this.stopTimer();
    this.detachScrubListeners();
    if (typeof Plotly !== 'undefined') {
      const el = document.getElementById(this.graphId);
      if (el) Plotly.purge(el);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────
  private boot(): void {
    this._currentIndex    = this.config?.currentIndex    ?? 0;
    this.timeWindowSeconds = this.config?.timeWindowSeconds ?? 2;
    this.startTimer();
    this.render();
  }

  // ── Public render ────────────────────────────────────────────────
  render(): void {
    if (typeof Plotly === 'undefined') { setTimeout(() => this.render(), 100); return; }
    if (!this.config?.signals?.length) return;
    if (!document.getElementById(this.graphId)) return; // element not in DOM yet/anymore

    switch (this.config.mode) {
      case 'reoccurrence': this.plotReoccurrenceMap(); break;
      case 'polar':        this.plotPolarGraph();      break;
      case 'xor':          this.plotXorGraph();        break;
      default:             this.plotTimeDomain();      break;
    }
  }

  // ── Computed getters ─────────────────────────────────────────────
  get timeWindow(): number {
    return Math.round(this.timeWindowSeconds * (this.config?.fs ?? 500));
  }
  get totalSamples(): number { return this.config?.signals?.length ?? 0; }
  get totalTimeSec(): number { return this.totalSamples / (this.config?.fs ?? 500); }
  get currentTimeSec(): number { return this._currentIndex / (this.config?.fs ?? 500); }

  /**
   * Progress as 0–100 based on how far into the *scrollable range* we are.
   * Using (totalSamples - timeWindow) as the denominator means the bar
   * reaches 100% exactly when the window hits the end — same logic the
   * original scrolling code used.
   */
  get progressPct(): number {
    const max = Math.max(1, this.totalSamples - this.timeWindow);
    return Math.min(100, (this._currentIndex / max) * 100);
  }

  get minWindowSec(): number { return 0.1; }
  get maxWindowSec(): number {
    if (!this.config?.signals?.length) return 10;
    return this.totalTimeSec;
  }
  get sliderStyle(): string {
    const range = this.maxWindowSec - this.minWindowSec;
    const pct = range > 0 ? ((this.timeWindowSeconds - this.minWindowSec) / range) * 100 : 50;
    return `--pct: ${pct}%`;
  }

  hasSelectedChannels(): boolean {
    return this.config?.selectedChannels?.some(c => c) ?? false;
  }

  // ── Transport actions ────────────────────────────────────────────
  togglePlayPause(): void {
    this.isPaused = !this.isPaused;
    if (!this.isPaused && !this.timer) this.startTimer();
    this.emitPlaybackChange();
  }

  onSpeedChange(): void { this.emitPlaybackChange(); }

  onWindowSlider(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.timeWindowSeconds = val;
    this.render();
    this.emitPlaybackChange();
  }

  // ── Scrub ────────────────────────────────────────────────────────
  /**
   * mousedown on the track — snapshot the rect once, apply immediately,
   * then attach document-level move/up listeners so the drag keeps
   * working even when the mouse leaves the element.
   */
  onScrubStart(event: MouseEvent): void {
    event.preventDefault();
    this.isScrubbing = true;

    // Cache the track's bounding rect for the entire drag gesture
    this._scrubTrackRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.applyScrubFromClientX(event.clientX);

    // Create bound references so we can remove them precisely
    this._boundScrubMove = (e: MouseEvent) => this.handleScrubMove(e);
    this._boundScrubUp   = (e: MouseEvent) => this.handleScrubUp(e);

    // Attach outside Angular zone — we drive CD ourselves each move
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this._boundScrubMove);
      document.addEventListener('mouseup',   this._boundScrubUp);
    });

    // Trigger immediate CD so the thumb visually jumps to the clicked spot
    this.cdr.markForCheck();
  }

  private handleScrubMove(event: MouseEvent): void {
    if (!this.isScrubbing) return;
    this.applyScrubFromClientX(event.clientX);
    // Re-enter zone just for Plotly + template update
    this.zone.run(() => {
      this.render();
      this.cdr.markForCheck();
    });
  }

  private handleScrubUp(event: MouseEvent): void {
    this.applyScrubFromClientX(event.clientX);
    this.isScrubbing = false;
    this.detachScrubListeners();
    this.zone.run(() => {
      this.render();
      this.emitPlaybackChange();
      this.cdr.markForCheck();
    });
  }

  /**
   * Converts an absolute clientX into a sample index and writes it to
   * _currentIndex. Uses the cached _scrubTrackRect so it's safe to call
   * from mousemove without triggering layout thrash.
   */
  private applyScrubFromClientX(clientX: number): void {
    if (!this._scrubTrackRect) return;
    const ratio    = Math.max(0, Math.min(1, (clientX - this._scrubTrackRect.left) / this._scrubTrackRect.width));
    const maxIndex = Math.max(0, this.totalSamples - this.timeWindow);
    this._currentIndex = Math.round(ratio * maxIndex);
  }

  private detachScrubListeners(): void {
    if (this._boundScrubMove) document.removeEventListener('mousemove', this._boundScrubMove);
    if (this._boundScrubUp)   document.removeEventListener('mouseup',   this._boundScrubUp);
    this._scrubTrackRect = null;
  }

  private emitPlaybackChange(): void {
    this.playbackChange.emit({
      isPaused:          this.isPaused,
      currentIndex:      this._currentIndex,
      timeWindowSeconds: this.timeWindowSeconds,
      playbackSpeed:     this.playbackSpeed,
    });
  }

  // ── Timer — outside Angular zone; re-enters for each render tick ─
  private startTimer(): void {
    this.stopTimer();
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        // Skip ticks while the user is dragging the scrub bar
        if (this._destroyed || this.isPaused || !this.config?.signals?.length || this.isScrubbing) return;
        if (this.config.mode === 'time' && !this.hasSelectedChannels()) return;

        this._currentIndex += Math.round(10 * this.playbackSpeed);

        const maxIndex = this.totalSamples - this.timeWindow;
        if (this._currentIndex >= maxIndex) {
          if (this.loop) {
            this._currentIndex = 0;
          } else {
            this._currentIndex = Math.max(0, maxIndex);
            this.isPaused = true;
            this.stopTimer();
          }
        }

        // Re-enter Angular zone so both Plotly AND the template update
        this.zone.run(() => {
          this.render();
          this.cdr.markForCheck();
        });
      }, 50);
    });
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // ── Channel helpers ──────────────────────────────────────────────
  private getCheckedIndices(): number[] {
    return (this.config.selectedChannels ?? [])
      .map((sel, i) => sel ? i : -1)
      .filter(i => i !== -1);
  }

  // ── Plot methods ─────────────────────────────────────────────────
  private plotTimeDomain(): void {
    const { signals, channels, fs, signalType } = this.config;
    const checked = this.getCheckedIndices();
    if (!checked.length) { Plotly.purge(this.graphId); return; }

    const tw         = this.timeWindow;
    const visibleEnd = Math.min(this._currentIndex + tw, signals.length);
    const SPACING    = 3;
    const traces: any[] = [];

    checked.forEach((chIdx, stackIdx) => {
      const segment = signals.slice(this._currentIndex, visibleEnd).map(r => r[chIdx]);
      const xTime   = segment.map((_, i) => (this._currentIndex + i) / fs);
      const minVal  = Math.min(...segment);
      const maxVal  = Math.max(...segment);
      const range   = maxVal - minVal || 1;
      const yData   = segment.map(v => ((v - minVal) / range) + stackIdx * SPACING);

      traces.push({
        x: xTime, y: yData,
        type: 'scatter', mode: 'lines',
        name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 },
        hovertemplate: `${channels[chIdx]}<br>${this.xAxisLabel}: %{x:.3f}<br>Value: %{y:.3f}<extra></extra>`
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `${signalType.toUpperCase()} Signal Viewer – ${checked.length} Channel(s)`, font: { size: 20, color: '#002b5c' } },
      xaxis: { title: this.xAxisLabel, range: [this._currentIndex / fs, (visibleEnd - 1) / fs], gridcolor: '#e0e0e0' },
      yaxis: { tickvals: checked.map((_, i) => i * SPACING + 0.5), showticklabels: true, gridcolor: '#f0f0f0' },
      showlegend: true,
      legend: { orientation: 'v', x: 1.02, y: 1, font: { size: 12 } },
      height: 300 + (checked.length * 120),
      margin: { l: 60, r: 150, t: 80, b: 60 },
      plot_bgcolor: '#ffffff', paper_bgcolor: '#f8f9fa'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  private plotReoccurrenceMap(): void {
    const { signals, channels, reoccurrenceChX, reoccurrenceChY, reoccurrenceColorMap } = this.config;
    const visibleEnd = Math.min(this._currentIndex + this.timeWindow, signals.length);
    const xData = signals.slice(0, visibleEnd).map(r => r[reoccurrenceChX]);
    const yData = signals.slice(0, visibleEnd).map(r => r[reoccurrenceChY]);

    Plotly.react(this.graphId, [{
      x: xData, y: yData,
      type: 'scatter', mode: 'markers',
      marker: { color: xData.map((_, i) => i), colorscale: reoccurrenceColorMap, showscale: true, size: 5, opacity: 0.7 },
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
    const { signals, channels, fs, polarMode } = this.config;
    const checked = this.getCheckedIndices();
    if (!checked.length) { Plotly.purge(this.graphId); return; }

    const isCumulative = polarMode === 'cumulative';
    const startIndex   = isCumulative ? 0 : this._currentIndex;
    const visibleEnd   = Math.min(this._currentIndex + this.timeWindow, signals.length);
    const traces: any[] = [];

    checked.forEach(chIdx => {
      const segment = signals.slice(startIndex, visibleEnd).map(r => r[chIdx]);
      const theta = segment.map((_, i) => {
        const t = isCumulative ? i : (this._currentIndex + i);
        return ((t / fs % this.timeWindowSeconds) / this.timeWindowSeconds) * 360;
      });
      traces.push({
        type: 'scatterpolar', mode: 'lines',
        r: segment, theta, name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 }
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `Polar Graph (${isCumulative ? 'Cumulative' : 'Fixed Time'})`, font: { size: 20, color: '#1e3c72' } },
      polar: {
        radialaxis: { visible: true, gridcolor: '#e0e0e0' },
        angularaxis: { direction: 'clockwise', gridcolor: '#e0e0e0' }
      },
      showlegend: true, height: 550, margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff', paper_bgcolor: 'transparent'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  private plotXorGraph(): void {
    const { signals, channels, fs } = this.config;
    const checked = this.getCheckedIndices();
    if (!checked.length) { Plotly.purge(this.graphId); return; }

    const tw = this.timeWindow;
    const visibleEnd = Math.min(this._currentIndex + tw, signals.length);
    const scale = 1000;
    const traces: any[] = [];

    checked.forEach(chIdx => {
      const xorResult = new Array(tw).fill(0);
      let isFirst = true;
      for (let start = 0; start < visibleEnd; start += tw) {
        const chunk = signals.slice(start, Math.min(start + tw, visibleEnd)).map(r => r[chIdx]);
        chunk.forEach((val, i) => {
          xorResult[i] = isFirst ? val : ((Math.round(xorResult[i] * scale) ^ Math.round(val * scale)) / scale);
        });
        isFirst = false;
      }
      traces.push({
        x: xorResult.map((_, i) => i / fs), y: xorResult,
        type: 'scatter', mode: 'lines', name: channels[chIdx],
        line: { color: this.COLORS[chIdx % this.COLORS.length], width: 2 }
      });
    });

    Plotly.react(this.graphId, traces, {
      title: { text: `XOR Cumulative Graph (Chunk = ${this.timeWindowSeconds}s)`, font: { size: 20, color: '#1e3c72' } },
      xaxis: { title: 'Time (seconds)', gridcolor: '#e0e0e0' },
      yaxis: { title: 'XOR Amplitude', gridcolor: '#e0e0e0' },
      showlegend: true, height: 550, margin: { l: 80, r: 80, t: 80, b: 80 },
      plot_bgcolor: '#ffffff', paper_bgcolor: 'transparent'
    }, { responsive: true, displayModeBar: true, displaylogo: false });
  }
}