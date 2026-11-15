import { hasHighContrast } from '../art.js';
import { btn } from './dom.js';

const toggle = (key, label, on, note) => `<label class="toggle"><input type="checkbox" data-setting="${key}" ${on ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span><b>${label}</b><br><small>${note}</small></span></label>`;

export function settingsView(settings) {
  return `<section class="screen settings">
    <h1>Settings</h1>
    <div class="panel">
      ${hasHighContrast() ? toggle('hc', 'High contrast', settings.hc, 'Black-and-white dice and saturated colour layers (the art pack\'s high-contrast set).') : ''}
      ${toggle('reduceMotion', 'Reduced motion', settings.reduceMotion, 'Turns off lift, squash and bounce animations. Also follows your system setting.')}
    </div>
    <div class="stack">${btn('back', 'Back', { cls: 'primary' })}</div>
  </section>`;
}
