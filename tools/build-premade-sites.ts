/* Kept as a compatibility entrypoint for the original Northline release command. */
process.argv.splice(2, process.argv.length - 2, 'build', 'independent-studio', '2.0.9');
await import('./premade-sites.ts');
