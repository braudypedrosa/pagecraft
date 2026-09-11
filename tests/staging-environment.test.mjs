import {test,expect} from 'vitest';
import {validateStagingEnvironment} from '../server/src/staging-environment.ts';
const project='abcdefghijklmnopqrst';
const isolated={EDITOR_HOST:'staging.itspagecraft.com',EDITOR_ORIGIN:'https://staging.itspagecraft.com',SUPABASE_URL:`https://${project}.supabase.co`,DATABASE_GATEWAY_URL:`https://${project}.supabase.co/functions/v1/pagecraft-db`,PAGECRAFT_STAGING_PROJECT_REF:project,PAGECRAFT_PUBLICATION_ROOT:'/home/itspbuku/pagecraft-staging-publications'};
test('isolated staging requires pinned matching auth and data project endpoints',()=>{
 expect(validateStagingEnvironment(isolated)).toBe('isolated');
 expect(validateStagingEnvironment({...isolated,DATABASE_GATEWAY_URL:`https://${project}.supabase.co/functions/v1/pagecraft-db-v3`})).toBe('isolated');
 for(const change of [
  {PAGECRAFT_STAGING_PROJECT_REF:undefined},
  {DATABASE_GATEWAY_URL:'https://pwgwvicrdbjiecjxiyvl.supabase.co/functions/v1/pagecraft-db'},
  {SUPABASE_URL:'https://wrong-project.supabase.co'},
  {SUPABASE_URL:`https://${project}.supabase.co?target=other`},
  {DATABASE_GATEWAY_URL:`https://${project}.supabase.co/functions/v1/another-function`},
  {DATABASE_URL:'postgres://second-database'},
  {EDITOR_ORIGIN:'https://build.itspagecraft.com'},
  {PAGECRAFT_PUBLICATION_ROOT:'/home/itspbuku/pagecraft-publications'},
  {PAGECRAFT_ALLOW_SHARED_DATABASE:'1'},
 ])expect(()=>validateStagingEnvironment({...isolated,...change})).toThrow();
});
test('the existing shared exception keeps workers off and cannot silently become isolated',()=>{
 const shared={...isolated,SUPABASE_URL:'https://pwgwvicrdbjiecjxiyvl.supabase.co',DATABASE_GATEWAY_URL:'https://pwgwvicrdbjiecjxiyvl.supabase.co/functions/v1/pagecraft-db',PAGECRAFT_STAGING_PROJECT_REF:undefined,PAGECRAFT_ALLOW_SHARED_DATABASE:'1',PAGECRAFT_BACKGROUND_WORKERS:'0'};
 expect(validateStagingEnvironment(shared)).toBe('shared-transition');
 expect(()=>validateStagingEnvironment({...shared,PAGECRAFT_ALLOW_SHARED_DATABASE:undefined})).toThrow();
 expect(()=>validateStagingEnvironment({...shared,PAGECRAFT_BACKGROUND_WORKERS:'1'})).toThrow();
 expect(()=>validateStagingEnvironment({...shared,PAGECRAFT_STAGING_PROJECT_REF:project})).toThrow();
});
test('local and production configuration is not changed by the staging guard',()=>{
 expect(validateStagingEnvironment({})).toBe('other');
 expect(validateStagingEnvironment({...isolated,EDITOR_HOST:'build.itspagecraft.com'})).toBe('other');
});
