const BOTS=Object.freeze([
 {id:'orion',name:'Orion',role:'Team leader',symbol:'✦',description:'Organises ideas, assigns work and coordinates project reviews.',audit:'seo'},
 {id:'atlas',name:'Atlas',role:'Code & websites',symbol:'▦',description:'Owns code and website development. Code execution requires a connected worker.',audit:'ui'},
 {id:'patch',name:'Patch',role:'Bug discovery',symbol:'✚',description:'Finds public-endpoint issues and hands actionable reports to Atlas.',audit:'qa'},
 {id:'cipher',name:'Cipher',role:'Security',symbol:'◇',description:'Reviews public security protections and records hardening tasks.',audit:'security'},
 {id:'sentinel',name:'Sentinel',role:'Testing',symbol:'◎',description:'Runs endpoint checks. Full signed-in browser tests need a test session.',audit:'qa'},
 {id:'scribe',name:'Scribe',role:'Messages & email',symbol:'≋',description:'Will organise support and email after a mailbox is connected.',connection:'Mailbox not connected'},
 {id:'vault',name:'Vault',role:'Finances',symbol:'◈',description:'Prepares financial proposals. Every financial action needs the owner’s approval.',connection:'Financial feed not connected'},
 {id:'pixel',name:'Pixel',role:'Creative content',symbol:'▧',description:'Organises creative briefs and advertising assets. Publishing stays separate.',connection:'Creative generation requires a connected paid plan'},
 {id:'social',name:'Social',role:'Social channels',symbol:'◌',description:'Coordinates strategy, publishing and engagement after channels are connected.',connection:'Social publishing channels not connected'},
 {id:'script',name:'Script',role:'Campaign ideas',symbol:'⌁',description:'Collects campaign concepts and routes them for review.',connection:'Campaign execution not connected'},
 {id:'pulse',name:'Pulse',role:'Customer insights',symbol:'⌁',description:'Will analyse approved, anonymised customer feedback.',connection:'Anonymised feedback feed not connected'},
 {id:'nova',name:'Nova',role:'Integrations & innovation',symbol:'✧',description:'Plans new project integrations and reviews the current project connection.',audit:'qa'},
]);
const botById=id=>BOTS.find(bot=>bot.id===id);
function proposalStatus(kind){return kind==='finance'?'awaiting_owner_approval':'proposed';}
function mayApproveFinancial(user){return user.email_verified===true&&user.email==='alp.ben@gmail.com';}
module.exports={BOTS,botById,proposalStatus,mayApproveFinancial};
