import { verifyAdapterAgainstFixture } from "./adapterExecutor";
import type { ApiAdapterRegistry } from "./adapterRegistry";
import type { DeclarativeApiAdapter } from "./types";

const VERIFIED_AT = "2026-08-30T16:45:00.000Z";

export async function seedBuiltInAdapters(registry: ApiAdapterRegistry): Promise<void> {
  for (const adapter of builtInAdapters()) {
    if (!registry.get(adapter.id)) await registry.save(adapter);
  }
}

export function builtInAdapters(): DeclarativeApiAdapter[] {
  return [
    verifyAdapterAgainstFixture(
      candidate({
        id: "weather.open-meteo.current.v1",
        providerId: "public-apis:9062de724650ef9cb797",
        capability: "weather.current",
        method: "GET",
        urlTemplate: "https://api.open-meteo.com/v1/forecast",
        parameters: [
          { name: "latitude", in: "query", required: true },
          { name: "longitude", in: "query", required: true },
          { name: "current", in: "query", default: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" },
          { name: "timezone", in: "query", default: "auto" },
          { name: "forecast_days", in: "query", default: 1 },
        ],
        output: {
          latitude: ".latitude",
          longitude: ".longitude",
          timezone: ".timezone",
          observedAt: ".current.time",
          temperatureC: ".current.temperature_2m",
          relativeHumidityPercent: ".current.relative_humidity_2m",
          weatherCode: ".current.weather_code",
          windSpeedKmh: ".current.wind_speed_10m",
        },
      }),
      {
        latitude: 18.52,
        longitude: 73.85,
        timezone: "Asia/Kolkata",
        current: {
          time: "2026-08-30T22:15",
          temperature_2m: 22.7,
          relative_humidity_2m: 90,
          weather_code: 2,
          wind_speed_10m: 13,
        },
      },
      "Built-in Open-Meteo schema and live endpoint validated on 2026-08-30.",
    ),
    verifyAdapterAgainstFixture(
      candidate({
        id: "currency.frankfurter.rate.v2",
        providerId: "frankfurter:official-v2",
        capability: "currency.exchange_rate",
        method: "GET",
        urlTemplate: "https://api.frankfurter.dev/v2/rate/{base}/{quote}",
        parameters: [
          { name: "base", in: "path", required: true },
          { name: "quote", in: "path", required: true },
        ],
        output: {
          rateDate: ".date",
          baseCurrency: ".base",
          quoteCurrency: ".quote",
          rate: ".rate",
        },
      }),
      {
        date: "2026-08-30",
        base: "USD",
        quote: "INR",
        rate: 95.47,
      },
      "Official Frankfurter v2 single-pair schema and live USD/INR endpoint validated on 2026-08-30.",
    ),
    verifyAdapterAgainstFixture(
      candidate({
        id: "space.launch-library.upcoming.v1",
        providerId: "public-apis:1945ae01a7dc12f7ef47",
        capability: "space.rocket_launch.upcoming",
        method: "GET",
        urlTemplate: "https://ll.thespacedevs.com/2.2.0/launch/upcoming/",
        parameters: [
          { name: "net__gt", in: "query", required: true },
          { name: "limit", in: "query", default: 5 },
          { name: "ordering", in: "query", default: "net" },
        ],
        output: {
          totalUpcoming: ".count",
          name: ".results[0].name",
          launchTime: ".results[0].net",
          status: ".results[0].status.name",
          provider: ".results[0].launch_service_provider.name",
          rocket: ".results[0].rocket.configuration.full_name",
          location: ".results[0].pad.location.name",
          mission: ".results[0].mission.name",
        },
      }),
      {
        count: 1,
        results: [{
          name: "Example launch",
          net: "2026-09-01T00:00:00Z",
          status: { name: "Go for Launch" },
          launch_service_provider: { name: "Example provider" },
          rocket: { configuration: { full_name: "Example rocket" } },
          pad: { location: { name: "Example location" } },
          mission: { name: "Example mission" },
        }],
      },
      "Built-in Launch Library 2 schema, ordering, and future-time filter validated on 2026-08-30.",
    ),
  ];
}

function candidate(
  input: Pick<DeclarativeApiAdapter, "id" | "providerId" | "capability" | "method" | "urlTemplate" | "parameters" | "output">,
): DeclarativeApiAdapter {
  return {
    ...input,
    verified: false,
    verifiedAt: null,
    verificationNotes: null,
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT,
  };
}
