import {checkSettingsSave} from '../../../morelord-core/scripts/testing/settings-save.js';
export const journeySettingsSaveCheck={id:'journeys.settings-save-and-close',run:()=>checkSettingsSave('morelord-journeys.configure',{nightCheckIntervalHours:'1'})};
