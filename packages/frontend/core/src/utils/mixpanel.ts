import mixpanelBrowser, { type OverridedMixpanel } from 'mixpanel-browser';

export const mixpanel = process.env.MIXPANEL_TOKEN
  ? mixpanelBrowser
  : new Proxy({} as OverridedMixpanel, {
      get: (_target, property) => {
        return (...args: any[]) => {
          console.info(
            `Mixpanel is not initialized, calling ${String(property)} with args: ${JSON.stringify(args)}`
          );
        };
      },
    });
