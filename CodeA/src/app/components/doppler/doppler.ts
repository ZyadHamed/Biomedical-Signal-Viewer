import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare const Chart: any;

@Component({
  selector: 'app-doppler',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './doppler.html',
  styleUrls: ['./doppler.css']
})
export class DopplerComponent implements OnInit, OnDestroy {

  step: number = 1;
  mode: string = '';

  // Generation parameters
  frequency: number = 440;
  velocity: number = 20;
  duration: number = 5;
  samplingRate: number = 44100;

  // Generated data
  generatedAudioUrl: string | null = null;
  generatedSignal: number[] = [];
  generatedFrequency: number[] = [];
  generatedTime: number[] = [];

  maxFrequency: number = 0;
  minFrequency: number = 0;
  shiftRatio: number = 0;

  // Analysis
  uploadedFile: File | null = null;
  uploadedAudioUrl: string | null = null;

  estimatedVelocity: number = 0;
  estimatedFrequency: number = 0;
  detectedMaxFreq: number = 0;
  detectedMinFreq: number = 0;
  confidenceScore: number = 0;

  isGenerating: boolean = false;
  isAnalyzing: boolean = false;
  showResults: boolean = false;

  private charts: any = {};
  private readonly SPEED_OF_SOUND = 343;
  private readonly PERPENDICULAR_DISTANCE = 5;

  constructor() {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    Object.values(this.charts).forEach((chart: any) => {
      if (chart) chart.destroy();
    });
    if (this.generatedAudioUrl) URL.revokeObjectURL(this.generatedAudioUrl);
    if (this.uploadedAudioUrl) URL.revokeObjectURL(this.uploadedAudioUrl);
  }

  // Safe max - avoids call stack overflow on large arrays
  private safeMax(arr: number[]): number {
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > max) max = arr[i];
    }
    return max;
  }

  // Safe min - avoids call stack overflow on large arrays
  private safeMin(arr: number[]): number {
    let min = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
    }
    return min;
  }

  // Safe max of absolute values
  private safeMaxAbs(arr: number[]): number {
    let max = Math.abs(arr[0]);
    for (let i = 1; i < arr.length; i++) {
      const abs = Math.abs(arr[i]);
      if (abs > max) max = abs;
    }
    return max;
  }

  selectMode(selectedMode: string): void {
    this.mode = selectedMode;
    this.step = 2;
  }

  goBack(): void {
    if (this.step > 1) {
      this.step--;
      if (this.step === 1) {
        this.mode = '';
        this.resetAll();
      }
    }
  }

  resetAll(): void {
    this.generatedSignal = [];
    this.generatedFrequency = [];
    this.generatedTime = [];
    this.maxFrequency = 0;
    this.minFrequency = 0;
    this.shiftRatio = 0;
    this.uploadedFile = null;
    this.estimatedVelocity = 0;
    this.estimatedFrequency = 0;
    this.detectedMaxFreq = 0;
    this.detectedMinFreq = 0;
    this.confidenceScore = 0;
    this.showResults = false;
    this.isGenerating = false;
    this.isAnalyzing = false;

    if (this.generatedAudioUrl) {
      URL.revokeObjectURL(this.generatedAudioUrl);
      this.generatedAudioUrl = null;
    }
    if (this.uploadedAudioUrl) {
      URL.revokeObjectURL(this.uploadedAudioUrl);
      this.uploadedAudioUrl = null;
    }
    Object.values(this.charts).forEach((chart: any) => {
      if (chart) chart.destroy();
    });
    this.charts = {};
  }

  async generateDopplerSound(): Promise<void> {
    this.isGenerating = true;
    this.showResults = false;

    try {
      const fs = this.samplingRate;
      const v_sound = this.SPEED_OF_SOUND;
      const d = this.PERPENDICULAR_DISTANCE;
      const numSamples = Math.floor(this.duration * fs);

      // Build time array
      const t: number[] = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        t[i] = i / fs;
      }

      const t0 = this.duration / 2.0;

      // Position of vehicle relative to observer
      const x: number[] = new Array(numSamples);
      const r: number[] = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        x[i] = this.velocity * (t[i] - t0);
        r[i] = Math.sqrt(x[i] * x[i] + d * d);
      }

      // Doppler-shifted frequency at each sample
      const f_o: number[] = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const v_rad = this.velocity * (-x[i]) / r[i];
        f_o[i] = this.frequency * v_sound / (v_sound - v_rad);
      }

      // Generate waveform using cumulative phase integration
      const dt = 1 / fs;
      let phi = 0;
      const signal: number[] = new Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        phi += 2 * Math.PI * f_o[i] * dt;
        signal[i] = Math.sin(phi);
      }

      // Amplitude envelope - inverse-square law (safe loop version)
      let maxR2 = 0;
      for (let i = 0; i < numSamples; i++) {
        const r2 = r[i] * r[i];
        if (r2 > maxR2) maxR2 = r2;
      }

      const amp: number[] = new Array(numSamples);
      let maxAmp = 0;
      for (let i = 0; i < numSamples; i++) {
        amp[i] = maxR2 / (r[i] * r[i]);
        if (amp[i] > maxAmp) maxAmp = amp[i];
      }

      for (let i = 0; i < numSamples; i++) {
        signal[i] *= (amp[i] / maxAmp);
      }

      // Normalize (safe loop version - no spread operator)
      const maxSignal = this.safeMaxAbs(signal);
      for (let i = 0; i < numSamples; i++) {
        signal[i] /= maxSignal;
      }

      // Stereo panning effect
      const stereoSignal = new Int16Array(numSamples * 2);
      for (let i = 0; i < numSamples; i++) {
        const pan = x[i] / r[i]; // -1 (left) to +1 (right)
        const left = signal[i] * Math.sqrt(0.5 * (1 - pan));
        const right = signal[i] * Math.sqrt(0.5 * (1 + pan));
        stereoSignal[i * 2] = Math.floor(left * 32767);
        stereoSignal[i * 2 + 1] = Math.floor(right * 32767);
      }

      const wavBlob = this.createWavBlob(stereoSignal, fs, 2);
      if (this.generatedAudioUrl) URL.revokeObjectURL(this.generatedAudioUrl);
      this.generatedAudioUrl = URL.createObjectURL(wavBlob);

      this.generatedTime = t;
      this.generatedSignal = signal;
      this.generatedFrequency = f_o;

      // Safe max/min - no spread operator
      this.maxFrequency = this.safeMax(f_o);
      this.minFrequency = this.safeMin(f_o);
      this.shiftRatio = this.maxFrequency / this.minFrequency;

      this.showResults = true;

      setTimeout(() => {
        this.plotAmplitudeChart();
        this.plotFrequencyChart();
      }, 100);

    } catch (error) {
      alert('Error generating sound: ' + error);
    } finally {
      this.isGenerating = false;
    }
  }

  private createWavBlob(samples: Int16Array, sampleRate: number, numChannels: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
      view.setInt16(44 + i * 2, samples[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private plotAmplitudeChart(): void {
    const canvas = document.getElementById('amplitudeChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (this.charts['amplitude']) this.charts['amplitude'].destroy();

    const downsample = 100;
    const displayTime = this.generatedTime.filter((_, i) => i % downsample === 0);
    const displaySignal = this.generatedSignal.filter((_, i) => i % downsample === 0);

    this.charts['amplitude'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayTime.map(t => t.toFixed(2)),
        datasets: [{
          label: 'Amplitude',
          data: displaySignal,
          borderColor: '#0059b3',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Doppler Signal - Amplitude vs Time' }
        },
        scales: {
          x: { title: { display: true, text: 'Time (s)' }, ticks: { maxTicksLimit: 10 } },
          y: { title: { display: true, text: 'Amplitude' } }
        }
      }
    });
  }

  private plotFrequencyChart(): void {
    const canvas = document.getElementById('frequencyChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (this.charts['frequency']) this.charts['frequency'].destroy();

    const downsample = 100;
    const displayTime = this.generatedTime.filter((_, i) => i % downsample === 0);
    const displayFreq = this.generatedFrequency.filter((_, i) => i % downsample === 0);

    this.charts['frequency'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayTime.map(t => t.toFixed(2)),
        datasets: [{
          label: 'Frequency (Hz)',
          data: displayFreq,
          borderColor: '#ff9800',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Doppler Effect - Frequency vs Time' }
        },
        scales: {
          x: { title: { display: true, text: 'Time (s)' }, ticks: { maxTicksLimit: 10 } },
          y: { title: { display: true, text: 'Frequency (Hz)' } }
        }
      }
    });
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file (.wav, .mp3, etc.)');
      return;
    }

    this.uploadedFile = file;
    if (this.uploadedAudioUrl) URL.revokeObjectURL(this.uploadedAudioUrl);
    this.uploadedAudioUrl = URL.createObjectURL(file);
  }

  async analyzeAudio(): Promise<void> {
    if (!this.uploadedFile) {
      alert('Please upload an audio file first');
      return;
    }

    this.isAnalyzing = true;
    this.showResults = false;

    try {
      const arrayBuffer = await this.uploadedFile.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      const result = this.estimateVelocityAndFrequency(channelData, sampleRate);

      this.estimatedVelocity = result.velocity;
      this.estimatedFrequency = result.baseFrequency;
      this.detectedMaxFreq = result.maxFreq;
      this.detectedMinFreq = result.minFreq;
      this.confidenceScore = result.confidence;
      this.showResults = true;

      audioContext.close();
    } catch (error) {
      alert('Error analyzing audio: ' + error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  private estimateVelocityAndFrequency(signal: Float32Array, sampleRate: number): any {
    const windowSize = 4096;
    const hopSize = windowSize / 4;
    const numWindows = Math.floor((signal.length - windowSize) / hopSize);
    const frequencies: number[] = [];

    for (let i = 0; i < numWindows; i++) {
      const start = i * hopSize;
      const windowData = signal.slice(start, start + windowSize);
      const freq = this.detectDominantFrequency(Array.from(windowData), sampleRate);
      if (freq > 0) frequencies.push(freq);
    }

    if (frequencies.length === 0) {
      return { velocity: 0, baseFrequency: 0, maxFreq: 0, minFreq: 0, confidence: 0 };
    }

    const maxFreq = this.safeMax(frequencies);
    const minFreq = this.safeMin(frequencies);
    const baseFrequency = (maxFreq + minFreq) / 2;
    const velocity = this.SPEED_OF_SOUND * (maxFreq - minFreq) / (maxFreq + minFreq);

    const avgFreq = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - avgFreq, 2), 0) / frequencies.length;
    const confidence = Math.min(100, Math.max(0, 100 - variance / 100));

    return {
      velocity: Math.abs(velocity),
      baseFrequency,
      maxFreq,
      minFreq,
      confidence
    };
  }

  private detectDominantFrequency(samples: number[], sampleRate: number): number {
    const size = Math.min(samples.length, 2048);
    let maxCorr = 0;
    let bestLag = 0;

    for (let lag = 20; lag < size / 2; lag++) {
      let corr = 0;
      for (let i = 0; i < size - lag; i++) {
        corr += samples[i] * samples[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag === 0) return 0;
    return sampleRate / bestLag;
  }
}