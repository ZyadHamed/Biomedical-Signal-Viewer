import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpParams, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface MicrobiomeResult {
  message: string;
  participantID: string;
  BacteriaProfile: Record<string, number>;
  BadBacteriaSum: number;
  GoodBacteriaSum: number;
  DI: number;
  HasDisease: boolean;
}

interface DiseaseOption {
  value: string;
  label: string;
  description: string;
}

// Mirrors MicrobiomeService.py exactly — used to colour bars correctly per disease
const DISEASE_BACTERIA_MAP: Record<string, { good: string[] }> = {
  Diarrhea: {
    good: [
      'Prevotella', 'Bacteroids', 'Bacteroides', 'Faecalibacterium',
      'Dialister', 'Collinsella', 'Clostridium sensu stricto 1',
      'Blauita', 'Blautia', 'Megasphaera',
    ],
  },
  Hydrocephalus: {
    good: [
      'Pseudomonas', 'Escherichia/Shigella', 'unclassified Halomonadaceae',
      'Diaphorobacter', 'Leuconostoc',
    ],
  },
  Diabetes: {
    good: ['Dialister', 'Odoribacter', 'Escherichia'],
  },
};

@Component({
  selector: 'app-microbiome',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './microbiome.html',
  styleUrls: ['./microbiome.css'],
})
export class Microbiome {
  private readonly BASE_URL = 'http://127.0.0.1:8000';

  diseases: DiseaseOption[] = [
    { value: 'Diarrhea',      label: 'Diarrhea',      description: 'Enteric microbiome imbalance analysis' },
    { value: 'Hydrocephalus', label: 'Hydrocephalus', description: 'CSF-related bacterial profile' },
    { value: 'Diabetes',      label: 'Diabetes',      description: 'Type 1 diabetes gut flora study' },
  ];

  // Step 1 — disease + upload
  selectedDisease: string | null = null;
  selectedFile: File | null = null;
  uploading = false;
  uploadDone = false;
  uploadError: string | null = null;

  // Step 2 — participant query
  participantIndex: number | null = null;
  fetching = false;
  fetchError: string | null = null;

  // Step 3 — results
  result: MicrobiomeResult | null = null;
  bacteriaEntries: { name: string; value: number; isGood: boolean }[] = [];
  maxBacteriaValue = 1;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  // ── Disease selection ────────────────────────────────────────────────────

  selectDisease(value: string): void {
    this.selectedDisease = value;
    this.uploadError = null;
  }

  // ── File selection ───────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.uploadError = null;
    }
  }

  // ── Upload dataset ───────────────────────────────────────────────────────

  uploadDataset(): void {
    if (!this.selectedDisease || !this.selectedFile) return;

    this.uploading = true;
    this.uploadError = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    const params = new HttpParams().set('diseaseName', this.selectedDisease);

    this.http.post(`${this.BASE_URL}/uploadmicrobiomedataset`, formData, { params }).subscribe({
      next: () => {
        this.uploading = false;
        this.uploadDone = true;
        this.cdr.detectChanges()
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err?.error?.message ?? err?.message ?? 'Upload failed. Only .csv files are accepted.';
      },
    });
  }

  // ── Fetch participant ────────────────────────────────────────────────────

  fetchParticipant(): void {
    if (this.participantIndex === null || !this.selectedDisease) return;

    this.fetching = true;
    this.fetchError = null;
    this.result = null;

    const params = new HttpParams()
      .set('diseaseName', this.selectedDisease)
      .set('participantIndex', String(this.participantIndex));

    this.http.get<MicrobiomeResult>(`${this.BASE_URL}/getmicrobiomepatientdata`, { params }).subscribe({
      next: (data) => {
        this.fetching = false;
        this.result = data;
        this.buildBacteriaEntries(data.BacteriaProfile);
        this.cdr.detectChanges()
      },
      error: (err) => {
        this.fetching = false;
        this.fetchError = err?.error?.detail ?? err?.message ?? 'Could not retrieve participant data.';
      },
    });
  }

  // ── Navigation helpers ───────────────────────────────────────────────────

  /** Go back to the participant query screen (keep upload state) */
  resetToQuery(): void {
    this.result = null;
    this.bacteriaEntries = [];
    this.fetchError = null;
  }

  /** Go all the way back to upload (clear everything) */
  resetUpload(): void {
    this.uploadDone = false;
    this.uploadError = null;
    this.selectedFile = null;
    this.selectedDisease = null;
    this.result = null;
    this.bacteriaEntries = [];
    this.participantIndex = null;
    this.fetchError = null;
  }

  // ── Chart helpers ────────────────────────────────────────────────────────

  private buildBacteriaEntries(profile: Record<string, number>): void {
    const goodSet = new Set(
      (this.selectedDisease ? DISEASE_BACTERIA_MAP[this.selectedDisease]?.good : [])
        .map((g) => g.toLowerCase())
    );

    this.bacteriaEntries = Object.entries(profile)
      .map(([name, value]) => ({ name, value, isGood: goodSet.has(name.toLowerCase()) }))
      .sort((a, b) => b.value - a.value);

    this.maxBacteriaValue = Math.max(...this.bacteriaEntries.map((e) => e.value), 1);
  }

  getBarWidth(value: number): number {
    return (value / this.maxBacteriaValue) * 100;
  }

  getDILabel(di: number): string {
    if (di < 0)   return 'No good bacteria detected';
    if (di < 0.5) return 'Low dysbiosis';
    if (di < 1.5) return 'Moderate dysbiosis';
    return 'High dysbiosis';
  }

  getDICardClass(di: number): string {
    if (di < 0)   return 'kpi-card--di-undef';
    if (di < 0.5) return 'kpi-card--di-low';
    if (di < 1.5) return 'kpi-card--di-mid';
    return 'kpi-card--di-high';
  }
}