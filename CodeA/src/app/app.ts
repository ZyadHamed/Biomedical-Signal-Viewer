import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SignalViewerComponent } from './components/signal-viewer/signal-viewer';

@Component({
  selector: 'app-root',
  imports: [SignalViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 't1';
  
}