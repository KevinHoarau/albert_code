import { TelemetryEventName, type TelemetryPropertiesProvider } from "./types"

/**
 * albert_change - telemetry removed. The API is kept for the call sites
 * inherited from Kilo, but nothing is captured, logged or sent.
 */
export class TelemetryProxy {
  private static singleton: TelemetryProxy | undefined

  private constructor() {}

  static getInstance(): TelemetryProxy {
    return (TelemetryProxy.singleton ??= new TelemetryProxy())
  }

  static capture(_event: TelemetryEventName, _properties?: Record<string, unknown>) {}

  configure(_url: string, _password: string) {}

  setProvider(_provider: TelemetryPropertiesProvider) {}

  isVSCodeTelemetryEnabled(): boolean {
    return false
  }

  capture(_event: TelemetryEventName, _properties?: Record<string, unknown>) {}

  setEnabled(_enabled: boolean) {}

  shutdown() {}
}
