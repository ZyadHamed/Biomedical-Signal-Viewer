import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalGraphComponent, SignalGraphConfig } from '../signal-graph/signal-graph.component';


interface WeekValue {
  week: number;
  value: number;
}

interface BacteriumEntry {
  name: string;
  data: WeekValue[];
}

interface MicrobiomeResult {
  participant_id: string;
  diagnosis: string;
  Dysbiosis_Index: WeekValue[];
  Average_Dysbiosis_Index: number;
  Good_Bacteria: BacteriumEntry[];
  Bad_Bacteria: BacteriumEntry[];
}

@Component({
  selector: 'app-microbiome',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SignalGraphComponent],
  templateUrl: './microbiome.html',
  styleUrls: ['./microbiome.css'],
})
export class Microbiome {
  private readonly BASE_URL = 'http://127.0.0.1:8000';

  // Step 1 — upload
  metadataFile: File | null = null;
  taxonomyFile: File | null = null;
  uploading = false;
  uploadDone = false;
  uploadError: string | null = null;

  // Step 2 — query
  participants = [
  { id: 'C3001', diagnosis: 'CD' }, { id: 'C3002', diagnosis: 'CD' },
  { id: 'C3003', diagnosis: 'UC' }, { id: 'C3004', diagnosis: 'UC' },
  { id: 'C3005', diagnosis: 'UC' }, { id: 'C3006', diagnosis: 'UC' },
  { id: 'C3011', diagnosis: 'UC' }, { id: 'C3015', diagnosis: 'UC' },
  { id: 'C3016', diagnosis: 'CD' }, { id: 'C3017', diagnosis: 'CD' },
  { id: 'C3021', diagnosis: 'CD' }, { id: 'C3022', diagnosis: 'nonIBD' },
  { id: 'C3023', diagnosis: 'CD' }, { id: 'C3027', diagnosis: 'CD' },
  { id: 'C3029', diagnosis: 'UC' }, { id: 'C3030', diagnosis: 'CD' },
  { id: 'C3031', diagnosis: 'CD' }, { id: 'C3032', diagnosis: 'UC' },
  { id: 'C3034', diagnosis: 'UC' }, { id: 'C3035', diagnosis: 'CD' },
  { id: 'C3037', diagnosis: 'UC' }, { id: 'H4001', diagnosis: 'CD' },
  { id: 'H4004', diagnosis: 'CD' }, { id: 'H4006', diagnosis: 'CD' },
  { id: 'H4007', diagnosis: 'CD' }, { id: 'H4008', diagnosis: 'nonIBD' },
  { id: 'H4009', diagnosis: 'nonIBD' }, { id: 'H4010', diagnosis: 'UC' },
  { id: 'H4013', diagnosis: 'nonIBD' }, { id: 'H4014', diagnosis: 'CD' },
  { id: 'H4015', diagnosis: 'CD' }, { id: 'H4016', diagnosis: 'nonIBD' },
  { id: 'H4017', diagnosis: 'CD' }, { id: 'H4018', diagnosis: 'nonIBD' },
  { id: 'H4019', diagnosis: 'UC' }, { id: 'H4020', diagnosis: 'CD' },
  { id: 'H4022', diagnosis: 'nonIBD' }, { id: 'H4023', diagnosis: 'nonIBD' },
  { id: 'H4024', diagnosis: 'nonIBD' }, { id: 'H4028', diagnosis: 'CD' },
  { id: 'H4031', diagnosis: 'CD' }, { id: 'H4035', diagnosis: 'UC' },
  { id: 'H4038', diagnosis: 'CD' }, { id: 'H4039', diagnosis: 'CD' },
  { id: 'H4040', diagnosis: 'UC' }, { id: 'H4042', diagnosis: 'UC' },
  { id: 'H4043', diagnosis: 'CD' }, { id: 'H4044', diagnosis: 'UC' },
  { id: 'H4045', diagnosis: 'nonIBD' }, { id: 'M2008', diagnosis: 'CD' },
  { id: 'M2014', diagnosis: 'CD' }, { id: 'M2021', diagnosis: 'CD' },
  { id: 'M2025', diagnosis: 'CD' }, { id: 'M2026', diagnosis: 'UC' },
  { id: 'M2027', diagnosis: 'CD' }, { id: 'M2028', diagnosis: 'CD' },
  { id: 'M2034', diagnosis: 'CD' }, { id: 'M2039', diagnosis: 'nonIBD' },
  { id: 'M2041', diagnosis: 'nonIBD' }, { id: 'M2042', diagnosis: 'nonIBD' },
  { id: 'M2047', diagnosis: 'nonIBD' }, { id: 'M2060', diagnosis: 'nonIBD' },
  { id: 'M2061', diagnosis: 'nonIBD' }, { id: 'M2064', diagnosis: 'UC' },
  { id: 'M2068', diagnosis: 'CD' }, { id: 'M2069', diagnosis: 'UC' },
  { id: 'M2072', diagnosis: 'nonIBD' }, { id: 'M2075', diagnosis: 'nonIBD' },
  { id: 'M2084', diagnosis: 'nonIBD' }, { id: 'P6005', diagnosis: 'CD' },
  { id: 'P6009', diagnosis: 'CD' }, { id: 'P6012', diagnosis: 'UC' },
  { id: 'P6013', diagnosis: 'UC' }, { id: 'P6014', diagnosis: 'nonIBD' },
  { id: 'P6016', diagnosis: 'CD' }, { id: 'P6017', diagnosis: 'nonIBD' },
  { id: 'P6018', diagnosis: 'nonIBD' }, { id: 'P6024', diagnosis: 'CD' },
  { id: 'P6025', diagnosis: 'UC' }, { id: 'P6028', diagnosis: 'CD' },
  { id: 'P6033', diagnosis: 'CD' }, { id: 'C3008', diagnosis: 'CD' },
  { id: 'C3009', diagnosis: 'CD' }, { id: 'C3010', diagnosis: 'CD' },
  { id: 'C3012', diagnosis: 'CD' }, { id: 'C3013', diagnosis: 'UC' },
  { id: 'C3028', diagnosis: 'CD' }, { id: 'E5004', diagnosis: 'UC' },
  { id: 'E5009', diagnosis: 'CD' }, { id: 'H4027', diagnosis: 'UC' },
  { id: 'H4030', diagnosis: 'CD' }, { id: 'H4032', diagnosis: 'CD' },
  { id: 'P6010', diagnosis: 'CD' }, { id: 'E5013', diagnosis: 'CD' },
  { id: 'E5001', diagnosis: 'CD' }, { id: 'M2048', diagnosis: 'nonIBD' },
  { id: 'M2071', diagnosis: 'UC' }, { id: 'M2077', diagnosis: 'nonIBD' },
  { id: 'M2079', diagnosis: 'nonIBD' }, { id: 'M2083', diagnosis: 'UC' },
  { id: 'M2085', diagnosis: 'CD' }, { id: 'M2097', diagnosis: 'nonIBD' },
  { id: 'M2103', diagnosis: 'UC' }, { id: 'P6035', diagnosis: 'UC' },
  { id: 'P6037', diagnosis: 'CD' }, { id: 'P6038', diagnosis: 'UC' },
  { id: 'C3007', diagnosis: 'CD' }, { id: 'C3019', diagnosis: 'CD' },
  { id: 'C3020', diagnosis: 'CD' }, { id: 'C3024', diagnosis: 'CD' },
  { id: 'C3033', diagnosis: 'CD' }, { id: 'C3036', diagnosis: 'UC' },
  { id: 'E5002', diagnosis: 'nonIBD' }, { id: 'E5003', diagnosis: 'CD' },
  { id: 'E5006', diagnosis: 'CD' }, { id: 'E5008', diagnosis: 'UC' },
  { id: 'E5019', diagnosis: 'CD' }, { id: 'E5022', diagnosis: 'UC' },
  { id: 'E5023', diagnosis: 'CD' }, { id: 'H4011', diagnosis: 'CD' },
  { id: 'H4012', diagnosis: 'CD' }, { id: 'M2010', diagnosis: 'CD' },
  { id: 'M2024', diagnosis: 'UC' }, { id: 'M2058', diagnosis: 'CD' },
  { id: 'M2059', diagnosis: 'UC' }, { id: 'M2067', diagnosis: 'UC' },
  { id: 'M2081', diagnosis: 'UC' }, { id: 'M2082', diagnosis: 'CD' },
  { id: 'M2086', diagnosis: 'CD' }, { id: 'M2091', diagnosis: 'UC' },
  { id: 'M2044', diagnosis: 'CD' },
];

participantIndex: number | null = null;
  fetching = false;
  fetchError: string | null = null;

  // Step 3 — results
  result: MicrobiomeResult | null = null;

  // Precomputed max values for bar scaling
  maxDI = 1;
  maxGoodValue = 1;
  maxBadValue = 1;

  dysbiosisConfig: SignalGraphConfig | null = null;
  goodBacteriaConfig: SignalGraphConfig | null = null;
  badBacteriaConfig: SignalGraphConfig | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  onMetadataFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.metadataFile = input.files[0];
  }

  onTaxonomyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.taxonomyFile = input.files[0];
  }

  uploadDataset(): void {
    if (!this.metadataFile || !this.taxonomyFile) return;

    this.uploading = true;
    this.uploadError = null;

    const formData = new FormData();
    formData.append('metadataFile', this.metadataFile);
    formData.append('taxonomyFile', this.taxonomyFile);

    this.http.post(`${this.BASE_URL}/uploadmicrobiomedataset`, formData).subscribe({
      next: () => {
        this.uploading = false;
        this.uploadDone = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err?.error?.message ?? 'Upload failed.';
      },
    });
  }

  fetchParticipant(): void {
    if (this.participantIndex === null) return;

    this.fetching = true;
    this.fetchError = null;
    this.result = null;

    this.http.get<MicrobiomeResult>(
      `${this.BASE_URL}/getmicrobiomepatientdata`,
      { params: { participantIndex: String(this.participantIndex) } }
    ).subscribe({
    next: (data) => {
      this.fetching = false;
      this.result = data;
      this.computeMaxValues(data);
      
      this.dysbiosisConfig = this.dysbiosisGraphConfig;
      this.goodBacteriaConfig = this.goodBacteriaGraphConfig;
      this.badBacteriaConfig = this.badBacteriaGraphConfig;
      
      this.cdr.detectChanges();
    },
      error: (err) => {
        this.fetching = false;
        this.fetchError = err?.error?.detail ?? 'Could not retrieve participant data.';
      },
    });
  }

  private computeMaxValues(data: MicrobiomeResult): void {
    this.maxDI = Math.max(...data.Dysbiosis_Index.map(e => e.value), 1);
    this.maxGoodValue = Math.max(...data.Good_Bacteria.map(b => this.getLatestValue(b.data)), 1);
    this.maxBadValue  = Math.max(...data.Bad_Bacteria.map(b => this.getLatestValue(b.data)), 1);
  }
  private buildSignalsMatrix(bacteria: BacteriumEntry[]): number[][] {
  if (!bacteria.length) return [];
  const weeks = bacteria[0].data.map(d => d.week);
  return weeks.map((_, weekIdx) =>
    bacteria.map(b => b.data[weekIdx]?.value ?? 0)
  );
}

private baseConfig(): Omit<SignalGraphConfig, 'signals' | 'channels' | 'signalType'> {
  return {
    mode: 'time',
    fs: 1,                    // 1 sample per week — x-axis reads as "week index"
    selectedChannels: [],     // will be overridden
    currentIndex: 0,
    timeWindow: 999999,       // show all weeks at once, no scrolling
    timeWindowSeconds: 999999,
    polarMode: 'fixed',
    reoccurrenceChX: 0,
    reoccurrenceChY: 1,
    reoccurrenceColorMap: 'Viridis',
  };
}

get dysbiosisGraphConfig(): SignalGraphConfig {
  if (!this.result) return this.emptyConfig();
  const signals = this.result.Dysbiosis_Index.map(d => [d.value]);
  console.log("DI Signal");
  console.log(signals);
  return {
    ...this.baseConfig(),
    signals,
    channels: ['Dysbiosis Index'],
    signalType: 'Dysbiosis',
    selectedChannels: [true],
    timeWindow: signals.length,
    timeWindowSeconds: signals.length,
  };
}

get goodBacteriaGraphConfig(): SignalGraphConfig {
  if (!this.result?.Good_Bacteria.length) return this.emptyConfig();
  console.log("Bad Bacteria Signal");
  const signals = this.buildSignalsMatrix(this.result.Good_Bacteria);
  console.log(signals);
  return {
    ...this.baseConfig(),
    signals,
    channels: this.result.Good_Bacteria.map(b => b.name),
    signalType: 'Good Bacteria',
    selectedChannels: this.result.Good_Bacteria.map(() => true),
    timeWindow: signals.length,
    timeWindowSeconds: signals.length,
  };
}

get badBacteriaGraphConfig(): SignalGraphConfig {
  if (!this.result?.Bad_Bacteria.length) return this.emptyConfig();
  const signals = this.buildSignalsMatrix(this.result.Bad_Bacteria);
  return {
    ...this.baseConfig(),
    signals,
    channels: this.result.Bad_Bacteria.map(b => b.name),
    signalType: 'Bad Bacteria',
    selectedChannels: this.result.Bad_Bacteria.map(() => true),
    timeWindow: signals.length,
    timeWindowSeconds: signals.length,
  };
}

private emptyConfig(): SignalGraphConfig {
  return {
    ...this.baseConfig(),
    signals: [],
    channels: [],
    signalType: '',
    selectedChannels: [],
  };
}


  getLatestValue(data: WeekValue[]): number {
    if (!data?.length) return 0;
    return data[data.length - 1].value;
  }

  getDIBarWidth(value: number): number {
    return (value / this.maxDI) * 100;
  }

  getBacteriaBarWidth(value: number, type: 'good' | 'bad'): number {
    const max = type === 'good' ? this.maxGoodValue : this.maxBadValue;
    return (value / max) * 100;
  }

  getDILabel(di: number): string {
    if (di < 2.5) return 'Low dysbiosis';
    if (di < 4) return 'Moderate dysbiosis';
    return 'High dysbiosis';
  }

  getDICardClass(di: number): string {
    if (di < 2.5) return 'kpi-card--di-low';
    if (di < 4) return 'kpi-card--di-mid';
    return 'kpi-card--di-high';
  }

  resetToQuery(): void {
    this.result = null;
    this.fetchError = null;
    this.dysbiosisConfig = null;
    this.goodBacteriaConfig = null;
    this.badBacteriaConfig = null;
    this.cdr.detectChanges();
  }

  resetUpload(): void {
    this.uploadDone = false;
    this.uploadError = null;
    this.metadataFile = null;
    this.taxonomyFile = null;
    this.result = null;
    this.participantIndex = null;
    this.fetchError = null;
    this.dysbiosisConfig = null;
    this.goodBacteriaConfig = null;
    this.badBacteriaConfig = null;
    this.cdr.detectChanges();
  }
}