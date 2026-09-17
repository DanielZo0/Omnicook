export {};

declare global {
  namespace googletag {
    type SingleSize = [number, number];
    type GeneralSize = SingleSize | SingleSize[] | 'fluid';

    interface Slot {
      addService(service: PubAdsService): Slot;
      setTargeting(key: string, value: string | string[]): Slot;
    }

    interface PubAdsService {
      enableSingleRequest(): void;
      collapseEmptyDivs(): void;
    }

    interface OutOfPageFormatEnum {
      INTERSTITIAL: unknown;
    }

    interface Enums {
      OutOfPageFormat: OutOfPageFormatEnum;
    }

    interface GoogleTag {
      cmd: { push(callback: () => void): void };
      defineSlot(adUnitPath: string, size: GeneralSize, div: string): Slot | null;
      defineOutOfPageSlot(adUnitPath: string, div: string | unknown): Slot | null;
      pubads(): PubAdsService;
      enableServices(): void;
      display(div: string): void;
      destroySlots(slots?: Slot[]): void;
      enums: Enums;
    }
  }

  interface Window {
    googletag: googletag.GoogleTag & { cmd: googletag.GoogleTag['cmd'] };
  }
}
