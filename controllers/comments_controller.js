const Comment=require('../models/comment');
const Post= require('../models/post');
const commentsMailer=require('../mailers/comments_mailer');
const queue = require('../config/kue');
const commentEmailWorker= require('../workers/comment_email_worker'); 
const Like = require('../models/like');

module.exports.create=async function(req,res){
    try{
    let post= await Post.findById(req.body.post);
        if(post){
             let comment = await Comment.create({
                content:req.body.content,
                post:req.body.post,
                user:req.user._id
             });
             
             post.comments.push(comment);
             post.save();
             comment=await comment.populate('user','name email').execPopulate();
            // commentsMailer.newComment(comment);
            let job=queue.create('emails',comment).save(function(err){
                if(err){
                    console.log('error in sending to the queue');
                    return;
                }
                console.log('job enqueued',job.id);
            });
            if(req.xhr){
                return res.status(200).json({
                    data:{
                        comment:comment
                    },
                    message:"Comment created!"
                })
            }
             
             res.redirect('/');
             req.flash('success','comment created')
        }
    }catch(err){
        req.flash('error',err);
        return;
    }    
}


module.exports.destroy =async function(req,res){
    try{
        let comment= await Comment.findById(req.params.id);
            if(comment.user == req.user.id){
                let postId=comment.post;
                comment.remove();

                let post= await Post.findByIdAndUpdate(postId,{$pull:{comments:req.params.id}});
                await Like.deleteMany({Likeable:comment._id,onModel:'Comment'});
                    if(req.xhr){
                        return res.status(200).json({
                            data:{
                                comment_id:req.params.id
                            },
                            message:"Comment deleted"
                        });
                    }
                    req.flash('success','comment deleted');
                    return res.redirect('back');
            }else{
                req.flash('error','Cannot delete comment');
                return res.redirect('back');
            }
    }catch(err){
        req.flash('error',err);
        return;
    }
}
