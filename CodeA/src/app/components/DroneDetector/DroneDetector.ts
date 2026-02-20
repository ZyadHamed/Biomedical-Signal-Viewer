import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface DroneResult {
  message: string;
  AudioClass: number;
}

@Component({
  selector: 'app-drone-detector',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './DroneDetector.html',
  styleUrls: ['./DroneDetector.css'],
})
export class DroneDetectoromponent {
  private readonly BASE_URL = 'http://127.0.0.1:8000';

  selectedFile: File | null = null;
  classifying = false;
  uploadError: string | null = null;
  result: DroneResult | null = null;
  isDrone = false;
  audioObjectUrl: string = '';
  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.uploadError = null;
      this.audioObjectUrl = URL.createObjectURL(this.selectedFile);
    }
  }

  classify(): void {
    if (!this.selectedFile) return;

    this.classifying = true;
    this.uploadError = null;
    this.result = null;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<DroneResult>(`${this.BASE_URL}/classifydronesound`, formData).subscribe({
      next: (data) => {
        this.classifying = false;
        this.result = data;
        this.isDrone = data.AudioClass === 1.0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.classifying = false;
        this.uploadError = err?.error?.message ?? err?.message ?? 'Classification failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  reset(): void {
    this.result = null;
    this.selectedFile = null;
    this.uploadError = null;
    this.isDrone = false;
    URL.revokeObjectURL(this.audioObjectUrl);
    this.audioObjectUrl = '';
    this.cdr.detectChanges();
  }
}