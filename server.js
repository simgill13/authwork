const bodyParser = require('body-parser');
const {BasicStrategy} = require('passport-http');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');

const {DATABASE_URL, PORT} = require('./config');
const {BlogPost, UserPost} = require('./models');

const app = express();

app.use(morgan('common'));
app.use(bodyParser.json());

mongoose.Promise = global.Promise;



const strategy = new BasicStrategy(
  (username, password, cb) => {
    UserPost    
      .findOne({username})
      .exec()
      .then(user => {
        if (!user) {
          return cb(null, false, {
            message: 'Incorrect username'
          });
        }
        user.validatePassword(password)
        .then(function(value){
          if(value === true){
            return cb(null, user);
          }
          return cb(null, false);
        }) 
      })
      .catch(err => cb(err))
});

passport.use(strategy);




app.post('/newuser', (req,res)=> {
  if (!req.body) {
      return res.status(400).json({message: 'No request body'});
    }


   if (!('username' in req.body)) {
      return res.status(422).json({message: 'Missing field: username'});
    }

   let {username, password, firstname, lastname} = req.body;

  if (typeof username !== 'string') {
      return res.status(422).json({message: 'Incorrect field type: username'});
    }

  username = username.trim();

  if (username === '') {
      return res.status(422).json({message: 'Incorrect field length: username'});
    }

  if (!(password)) {
      return res.status(422).json({message: 'Missing field: password'});
    }
  if (typeof password !== 'string') {
      return res.status(422).json({message: 'Incorrect field type: password'});
    }

  password = password.trim();


  if (password === '') {
      return res.status(422).json({message: 'Incorrect field length: password'});
    }


    return UserPost
      .find({username})
      .count()
      .exec()
      .then(function(count){
        if (count > 0) {
          return res.status(422).json({message: 'username already taken'});
        }
        return UserPost.hashPassword(password)
      })
      .then(function(hash){
        console.log(firstname);
        return UserPost
        .create({
          username: username,
          password: hash,
          firstname: firstname,
          lastname: lastname
        })
        console.log()
      })
      .then(function(user){
        console.log(user);
        return res.status(201).json(user.apiRepr());
      })
      .catch(function(err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'})
      });


})








app.get('/newuser', (req, res) => {
  return UserPost
    .find()
    .exec()
    .then(users => res.json(users.map(user => user.apiRepr())))
    .catch(function(err){
      console.error(err);
      res.status(500).json({message: 'internal server error'})
    })
});




app.get('/validuser',passport.authenticate('basic', {session: false}),function(req,res) {
  return res.json({
    username:req.user.apiRepr()
  })  
})











































app.get('/posts', (req, res) => {
  BlogPost
    .find()
    .exec()
    .then(posts => {
      res.json(posts.map(post => post.apiRepr()));
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went terribly wrong'});
    });
});

app.get('/posts/:id', (req, res) => {
  BlogPost
    .findById(req.params.id)
    .exec()
    .then(post => res.json(post.apiRepr()))
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went horribly awry'});
    });
});

app.post('/posts', (req, res) => {
  const requiredFields = ['title', 'content', 'author'];
  for (let i=0; i<requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`
      console.error(message);
      return res.status(400).send(message);
    }
  }

  BlogPost
    .create({
      title: req.body.title,
      content: req.body.content,
      author: req.body.author
    })
    .then(blogPost => res.status(201).json(blogPost.apiRepr()))
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
    });

});


app.delete('/posts/:id', (req, res) => {
  BlogPost
    .findByIdAndRemove(req.params.id)
    .exec()
    .then(() => {
      res.status(204).json({message: 'success'});
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({error: 'something went terribly wrong'});
    });
});


app.put('/posts/:id', (req, res) => {
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    res.status(400).json({
      error: 'Request path id and request body id values must match'
    });
  }

  const updated = {};
  const updateableFields = ['title', 'content', 'author'];
  updateableFields.forEach(field => {
    if (field in req.body) {
      updated[field] = req.body[field];
    }
  });

  BlogPost
    .findByIdAndUpdate(req.params.id, {$set: updated}, {new: true})
    .exec()
    .then(updatedPost => res.status(201).json(updatedPost.apiRepr()))
    .catch(err => res.status(500).json({message: 'Something went wrong'}));
});


app.delete('/:id', (req, res) => {
  BlogPosts
    .findByIdAndRemove(req.params.id)
    .exec()
    .then(() => {
      console.log(`Deleted blog post with id \`${req.params.ID}\``);
      res.status(204).end();
    });
});


app.use('*', function(req, res) {
  res.status(404).json({message: 'Not Found'});
});


let server;
function runServer(databaseUrl=DATABASE_URL, port=PORT) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(port, () => {
        console.log(`Your app is listening on port ${port}`);
        resolve();
      })
      .on('error', err => {
        mongoose.disconnect();
        reject(err);
      });
    });
  });
}

function closeServer() {
  return mongoose.disconnect().then(() => {
     return new Promise((resolve, reject) => {
       console.log('Closing server');
       server.close(err => {
           if (err) {
               return reject(err);
           }
           resolve();
       });
     });
  });
}

if (require.main === module) {
  runServer().catch(err => console.error(err));
};

module.exports = {runServer, app, closeServer};
