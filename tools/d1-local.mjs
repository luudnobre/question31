/* Adaptador de desenvolvimento para executar as mesmas consultas do Worker. Node 24. */
import {DatabaseSync} from 'node:sqlite';
export class LocalD1 {
 constructor(filename=':memory:'){this.sqlite=new DatabaseSync(filename);this.sqlite.exec('PRAGMA foreign_keys=ON;');}
 async exec(sql){this.sqlite.exec(sql);return{count:1,duration:0};}
 prepare(sql){
  const db=this.sqlite;
  const make=(params=[])=>({
   bind:(...values)=>make(values),
   first:async column=>{const row=db.prepare(sql).get(...params);return row ? column ? row[column] : {...row} : null;},
   all:async()=>({results:db.prepare(sql).all(...params).map(row=>({...row})),success:true}),
   run:async()=>{const result=db.prepare(sql).run(...params);return{success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
  });
  return make();
 }
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(await statement.run());this.sqlite.exec('COMMIT');return results;}catch(error){this.sqlite.exec('ROLLBACK');throw error;}}
 close(){this.sqlite.close();}
}
