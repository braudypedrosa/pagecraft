import { describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Control } from '../app/src/core/types';

const controlsPosition = C.DEF.slider.controls.content.find(
  (control: Control) => control.k === 'controlsPosition',
)!;

describe('Slider controls position default', () => {
  test('a fresh slider selects the beside-slides option it renders', () => {
    const slider = C.N('slider');
    const options = controlsPosition.opts as string[][];

    expect(slider.props.controlsPosition).toBe('sides');
    expect(C.propVal(slider, controlsPosition.k)).toBe('sides');
    expect(options.some(([value]) => value === C.propVal(slider, controlsPosition.k))).toBe(true);
    expect(C.renderNode(slider, { edit: false })).not.toContain('controls-bottom');
  });

  test('a legacy slider with no stored position reads the rendered default without mutation', () => {
    const slider = C.N('slider');
    delete slider.props.controlsPosition;

    expect(Object.prototype.hasOwnProperty.call(slider.props, 'controlsPosition')).toBe(false);
    expect(C.propVal(slider, controlsPosition.k)).toBe('sides');
    expect(Object.prototype.hasOwnProperty.call(slider.props, 'controlsPosition')).toBe(false);
    expect(C.renderNode(slider, { edit: false })).not.toContain('controls-bottom');
    expect(Object.prototype.hasOwnProperty.call(slider.props, 'controlsPosition')).toBe(false);
  });

  test('the alternate option still renders controls below', () => {
    const slider = C.N('slider', { controlsPosition: 'bottom' });

    expect(C.propVal(slider, controlsPosition.k)).toBe('bottom');
    expect(C.renderNode(slider, { edit: false })).toContain('controls-bottom');
  });
});
