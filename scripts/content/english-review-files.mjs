/** Only conversation-authored proposal ledgers enter the independent review queue. */
export function listEnglishProposalFiles(names) {
 return ['root-additional-senses.jsonl','useful-expression-additions.jsonl',
  ...names.filter(name=>/^(?:headword|expression|sense)-additions-\d+\.jsonl$/u.test(name))
   .sort((a,b)=>a.localeCompare(b,'en',{numeric:true})),
 ];
}
import {exampleDigest} from './reviewed-examples.mjs';


/** A copied authoring helper must not silently replace another batch's proposals. */
export function assertEnglishProposalLedger(name,proposals,inputs=[]) {
 const match=/^headword-additions-(\d+)\.jsonl$/u.exec(name);
 if(!match)return;
 const part=Number(match[1]);
 if(part<1||!inputs.length)throw new Error('Missing frozen authoring input for '+name);
 const expectedReviewer='english-headword-author-'+part;
 const bindings=new Set(inputs.map(exampleDigest));
 for(const proposal of proposals){
  if(proposal.reviewer!==expectedReviewer||!bindings.has(proposal.selectionDigest)){
   throw new Error('Proposal belongs to a different authoring batch: '+name);
  }
 }
}
