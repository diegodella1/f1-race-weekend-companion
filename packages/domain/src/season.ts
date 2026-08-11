import { z } from 'zod';

export const circuitLayoutStatusSchema = z.enum(['verified', 'pending', 'unavailable']);
export const seasonEventStatusSchema = z.enum(['scheduled', 'completed', 'cancelled']);

export const catalogSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  role: z.enum(['calendar', 'entry_list', 'telemetry', 'circuit_image'])
});

export const circuitProfileSchema = z.object({
  id: z.string().min(1),
  circuitKey: z.number().int().nonnegative(),
  name: z.string().min(1),
  location: z.string().min(1),
  countryCode: z.string().min(2).max(3),
  countryName: z.string().min(1),
  type: z.enum(['Permanent', 'Street', 'Temporary', 'Unknown']),
  upstreamImageUrl: z.string().url().nullable(),
  layoutImageUrl: z.string().url().nullable(),
  layoutSourceUrl: z.string().url().nullable(),
  layoutStatus: circuitLayoutStatusSchema,
  layoutVerifiedAt: z.iso.datetime().nullable()
});

export const driverProfileSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  code: z.string().min(2).max(4),
  fullName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  countryCode: z.string().min(2).max(3).nullable(),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  teamColor: z.string().regex(/^#[0-9A-F]{6}$/iu)
});

export const teamProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-F]{6}$/iu),
  driverIds: z.array(z.string().min(1)).length(2)
});

export const seasonEventSchema = z.object({
  id: z.string().min(1),
  meetingKey: z.number().int().nonnegative(),
  name: z.string().min(1),
  officialName: z.string().min(1),
  circuitId: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: seasonEventStatusSchema
});

export const seasonCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  season: z.literal(2026),
  generatedAt: z.iso.datetime(),
  sources: z.array(catalogSourceSchema).min(3),
  events: z.array(seasonEventSchema),
  circuits: z.array(circuitProfileSchema),
  drivers: z.array(driverProfileSchema),
  teams: z.array(teamProfileSchema)
}).superRefine((catalog, context) => {
  validateUnique(catalog.events, 'event', context);
  validateUnique(catalog.circuits, 'circuit', context);
  validateUnique(catalog.drivers, 'driver', context);
  validateUnique(catalog.teams, 'team', context);

  const driverIds = new Set(catalog.drivers.map((driver) => driver.id));
  const teamIds = new Set(catalog.teams.map((team) => team.id));
  const circuitIds = new Set(catalog.circuits.map((circuit) => circuit.id));
  for (const driver of catalog.drivers) {
    if (!teamIds.has(driver.teamId)) addReferenceIssue(context, `Driver ${driver.id} references missing team ${driver.teamId}`);
  }
  for (const team of catalog.teams) {
    if (team.driverIds.some((driverId) => !driverIds.has(driverId))) addReferenceIssue(context, `Team ${team.id} references a missing driver`);
  }
  for (const event of catalog.events) {
    if (!circuitIds.has(event.circuitId)) addReferenceIssue(context, `Event ${event.id} references missing circuit ${event.circuitId}`);
  }
});

function validateUnique<T extends { id: string }>(items: T[], label: string, context: z.RefinementCtx): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    context.addIssue({ code: 'custom', message: `Duplicate ${label} ID` });
  }
}

function addReferenceIssue(context: z.RefinementCtx, message: string): void {
  context.addIssue({ code: 'custom', message });
}

export type CatalogSource = z.infer<typeof catalogSourceSchema>;
export type CircuitLayoutStatus = z.infer<typeof circuitLayoutStatusSchema>;
export type CircuitProfile = z.infer<typeof circuitProfileSchema>;
export type DriverProfile = z.infer<typeof driverProfileSchema>;
export type TeamProfile = z.infer<typeof teamProfileSchema>;
export type SeasonEvent = z.infer<typeof seasonEventSchema>;
export type SeasonCatalog = z.infer<typeof seasonCatalogSchema>;
