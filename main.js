const fs = require('fs')
const mc = require('minecraft-protocol')

const 2b2t = '2b2t.org'
const o = console.log

fs.readFile('secrets.json', (err, data)=>{
	if(err) throw err
	const user = JSON.parse(data)
	o(student)
})
