var util = require('util');
var Set = require("collections/set");
var Map = require("collections/map");
var Deque = require("collections/deque");
var moment = require("moment");
require('./logging')();

function JubDJ(config, gapi, chat) {
  var gapi = gapi;
  var chat = chat;
  var video_state = {
    start_time: Date.now(),
    duration: 0
  }
  var video_queues = Map(); // username --> video queue
  var dj_sched = []; // circular buffer of users signed up to DJ
  var current_users = new Set();
  var user_sockets = {};
  var broadcast = function() {}; // This will be set later by the socketeer
  var whisper = function() {}; // This will be set later by the socketeer
  var jub = this;

  // Sum of DJs' queue sizes
  var sum_videos_queued = function() {
    return video_queues.reduce(function(a,v,k) {
      if (dj_sched.indexOf(k) > -1)
        return a + v.length;
      else
        return a;
    }, 0);
  }

  // Rotate DJs until someone who has videos to play is first.
  var skip_idle_djs = function() {
    console.log('skipping idle', dj_sched);
    if (dj_sched.length > 1 && sum_videos_queued() > 0) {
      while (video_queues.get(dj_sched[0]).length == 0) {
        console.log('checking dj', dj_sched[0], 'who has',
                    video_queues.get(dj_sched[0]).length);
        dj_sched.push(dj_sched.shift());
        // REALLY don't want to get stuck looping forever
        if (sum_videos_queued() == 0)
          break;
      }
    }
  }

  // Periodically check the time so we can start the next video punctually.
  // When the time comes, pop the next DJ off the schedule and play his video.
  var rotate_videos = function() {
    // It's time to rotate videos
    if (Date.now() > video_state.start_time + video_state.duration ||
        Object.keys(video_state).length == 0) {
      // Anyone have anything to play?
      if (sum_videos_queued() > 0) {
        // Push the just-finished DJ to the back, if they're still here
        if (video_state.user) { // always true except init
          var last_dj = dj_sched.shift();
          if (current_users.has(video_state.user)) {
            dj_sched.push(last_dj);
          }
        }

        skip_idle_djs();
        var new_dj = dj_sched[0];
        console.log('rotated DJs to', new_dj);
        if (video_queues.has(new_dj) && video_queues.get(new_dj).length > 0) {
          var next_video = video_queues.get(new_dj).pop();
          next_video.start_time = Date.now();
          console.log('starting next video:', next_video['id']);
          jub.update_video_state(next_video);

          // Tell the clients to start the new video
          broadcast('video state', jub.emittable_video_state());

          // Send the new DJ his updated queue
          whisper(new_dj, 'queue', jub.emittable_queue_for(new_dj));
        }
      }
    }
  }
  setInterval(rotate_videos, 1000);

  // Enqueue a single video
  this.enqueue_video = function(video_obj, callback) {
    var user = video_obj.user;
    if (user) {
      gapi.video_specs(video_obj, function(obj) {
        if (obj.title && obj.duration && user) {
          // Create a queue for the user if there's not one
          if (!video_queues.has(user)) {
            video_queues.set(user, Deque());
          }
          video_queues.get(user).unshift(video_obj);
          console.log(user, 'enqueued video:', util.inspect(video_obj));
          whisper(user, 'queue', jub.emittable_queue_for(user));
        } else {
          console.log('failed to find info for video', video_obj.id);
        }
      });
    }
  }

  // Add an entire playlist to the queue
  this.enqueue_playlist = function(playlist_obj) {
    console.log('enqueued playlist:', util.inspect(playlist_obj));
    gapi.playlist(playlist_obj.id, function(video_list) {
      for (video_obj of video_list) {
        video_obj.user = playlist_obj.user;
        jub.enqueue_video(video_obj);
      }
    });
  }

  // TODO make this simpler once we have separate queues
  // There can be races here - if two people dequeue at the same time, one of
  // them will 'win' the race and get back to the clients first. Then the next
  // one, which won't include the change the first one made, will finish and
  // *that* is the version that clients will end up with.
  this.dequeue_video = function(user, callback) {
    if (video_queues.has(user) && video_queues.get(user).length > 0) {
      var new_queue = Deque();
      var queue_copy = video_queues.get(user).toArray();
      var found = false;
      while (queue_copy.length > 0) {
        var temp_item = queue_copy.shift();
        if (temp_item.user == user && !found) {
          console.log('dequeued:', temp_item);
          found = true;
        } else {
          // we started at the oldest so load up new queue end-to-start
          new_queue.push(temp_item);
        }
        video_queues.set(user, new_queue);
      }
      whisper(user, 'queue', jub.emittable_queue_for(user));
    }
  }

  // Allow users to skip their own videos; also allow anyone to skip a video
  // started by someone who has left the room.
  this.video_skipped = function(user) {
    if (user == video_state.user || dj_sched.indexOf(video_state.user) < 0) {
      video_state.duration = 0;
      chat.video_skipped(user);
    }
  }

  // TODO maybe this function should also broadcast
  this.update_video_state = function(new_state) {
    video_state = new_state;
    chat.video_started(new_state);
    console.log("Updated video state: %s", util.inspect(video_state));
  }

  this.emittable_video_state = function() {
    return {
      id: video_state.id,
      title: video_state.title,
      start_time: video_state.start_time,
      server_time: Date.now(),
    }
  }

  this.emittable_queue_for = function(user) {
    if (video_queues.has(user)) {
      console.log(video_queues.get(user).toArray());
      return video_queues.get(user).toArray();
    }
  }

  this.clear_users = function() {
    current_users.clear();
    current_users.add(chat.bot.name);
  };

  // Add the user to the end of the rotation if it's not already in the
  // rotation.
  this.add_dj = function(user) {
    var index = dj_sched.indexOf(user);
    if (index == -1) {
      dj_sched.push(user);
    }
    console.log('added DJ. dj_sched', dj_sched);
  }

  // Remove the user from the rotation if it's there
  this.remove_dj = function(user) {
    var index = dj_sched.indexOf(user);
    if (index > -1) {
      dj_sched.splice(index, 1);
    }
    console.log('removed DJ. dj_sched', dj_sched);
  }

  // Kinda weird that this fn has some knowledge about what the caller is going
  // to do next, but on the other hand the caller needs to pass in a callback
  // so that it can do its next task with the up-to-date data.
  this.add_user = function(user, socket, callback) {
    user_sockets[user] = socket;
    current_users.add(user);
    callback(current_users.toArray());
  }

  this.new_user_connection = function(user, callback) {
    chat.welcome(user, callback);
  }

  this.video_search = function(query, callback) {
    gapi.video_search(query, callback);
  }

  this.new_chat_message = function(query, callback) {
    chat.new_chat_message(query, callback);
  }

  this.set_broadcast_callback = function(callback) {
    broadcast = callback;
    chat.set_broadcast_callback(callback);
  }

  this.set_whisper_callback = function(callback) {
    whisper = callback
    chat.set_whisper_callback(callback);
  }

}

module.exports = function(config, gapi, chat) {
  var jub = new JubDJ(config, gapi, chat);
  var first_video = {
    id: 'ELAs5Q8Itfs', // TODO different placeholder
    user: chat.bot.name
  };
  var second_video = {
    id: 'ELAs5Q8Itfs', // TODO different placeholder
    user: chat.bot.name
  };
  var third_video = {
    id: 'ELAs5Q8Itfs', // TODO different placeholder
    user: chat.bot.name
  };

  jub.enqueue_video(first_video);
  jub.enqueue_video(second_video);
  jub.enqueue_video(third_video);
  jub.add_dj(chat.bot.name);

  return jub
}
