import { expect, test } from 'vitest';
import { founderCrmInsights } from '../src/founder-crm-insights.ts';
import type { FounderCrmData } from '../src/founder-crm-types.ts';

function fixture(): FounderCrmData {
  const accounts = [
    {id:'previous',createdAt:'2026-08-20T00:00:00Z'},
    {id:'boundary',createdAt:'2026-09-09T12:00:00Z'},
    {id:'current',createdAt:'2026-09-20T00:00:00Z'},
    {id:'test',createdAt:'2026-09-21T00:00:00Z'},
    {id:'future',createdAt:'2026-10-10T00:00:00Z'},
  ].map(row=>({...row,authUserId:row.id,name:row.id,email:'sample@example.test',plan:'free',ownedSites:1,publishedSites:row.id==='current'?0:1,mediaBytes:0,lastEditedAt:null}));
  return {
    generatedAt:'2026-10-09T12:00:00Z',range:'30d',periodStart:'2026-09-09T12:00:00Z',periodEnd:'2026-10-09T12:00:00Z',includeTests:false,
    platform:{state:'available',snapshot:{accounts,sites:[],accountTotal:5,siteTotal:0,coverage:'complete'}},
    crm:{state:'available',contacts:[]},
    customers:accounts.filter(row=>row.id!=='test').map(row=>({id:row.id,accountId:row.id,contactId:null,name:row.id,email:row.email,company:'',plan:'free',ownedSites:1,publishedSites:row.publishedSites,mediaBytes:0,joinedAt:row.createdAt,lastEditedAt:null,stage:'lead',source:'unknown',notes:'',followUpOn:null,isTest:false,revision:null})),
    analytics:{accountGrowth:[],siteGrowth:[],newAccounts:2,activation:null,planMix:[],pipeline:[],sources:[],followUps:[],chargeHistory:[]},
    billing:{status:'ok',generatedAt:'2026-10-09T12:00:00Z',platform:{siteCount:0,accountCount:5},costs:{state:'available',basis:'monthly_budget',rows:[],totals:[]},billing:{state:'not_connected',environment:null}},
  };
}

test('current and previous windows do not overlap, exclude tests and ignore future timestamps',()=>{
  expect(founderCrmInsights(fixture())).toEqual({newAccounts:2,previousAccounts:1,newSites:0,previousSites:0,unpublishedAccounts:1,followUpsDue:0});
});
test('unavailable sources stay unknown instead of creating false business zeros',()=>{
  const data=fixture();data.platform={state:'unavailable',snapshot:null};data.crm={state:'unavailable',contacts:[]};
  expect(Object.values(founderCrmInsights(data))).toEqual([null,null,null,null,null,null]);
});
test('including tests follows the selected record setting',()=>{
  const data=fixture();data.includeTests=true;
  expect(founderCrmInsights(data).newAccounts).toBe(3);
});
test('the previous inclusive UTC window includes its first midnight',()=>{
  const data=fixture();
  data.periodStart='2026-09-10T00:00:00.000Z';
  data.periodEnd='2026-10-09T23:59:59.999Z';
  data.platform.snapshot!.accounts.find(row=>row.id==='previous')!.createdAt='2026-08-11T00:00:00.000Z';
  expect(founderCrmInsights(data).previousAccounts).toBe(2);
});
