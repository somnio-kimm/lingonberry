/** Wait for the public settled-result marker; result rendering may be coalesced. */
export async function searchWordList(page,value){
 const input=page.locator('#search-input');await input.fill(value);
 await page.waitForFunction(query=>document.querySelector('#wordlist-results')?.dataset.query===query,value);
 return input;
}
