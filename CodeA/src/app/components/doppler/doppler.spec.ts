import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Doppler } from './doppler';

describe('Doppler', () => {
  let component: Doppler;
  let fixture: ComponentFixture<Doppler>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Doppler]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Doppler);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
