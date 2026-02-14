import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignalViewer } from './signal-viewer';

describe('SignalViewer', () => {
  let component: SignalViewer;
  let fixture: ComponentFixture<SignalViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalViewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignalViewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
