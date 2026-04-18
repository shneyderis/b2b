import { env } from './env.js';
import { createApp } from './index.js';

createApp().listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});
