import { FirebaseCollections } from './FIrebaseCollections';
import { IChannel } from '../components/Channels';
import firebase from 'firebase';
import { IMessage } from '../components/Messages';

class ChannelsApi {
    collectionRef = firebase.firestore().collection(FirebaseCollections.Channels);

    getChannels(user: string) {
        return this.collectionRef
            .where('members', 'array-contains', user)
            .get()
            .then(querySnapshot => querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }

    async loadMessages(channel: IChannel) {
        const snapshot = await this.collectionRef
            .doc(channel.id)
            .collection(FirebaseCollections.Messages)
            .orderBy('createdAt', 'asc')
            .get();

        return this.getMessagesFromSnapshot(snapshot);
    }

    sendMessage(channel: IChannel, message: string, username: string) {
        firebase.firestore().runTransaction(transaction => {
            return this.updateMessage(transaction, channel, message, username);
        });
    }

    listenUpdates(channel: IChannel, cb: (error: Error | null, messages: IMessage[]) => void) {
        return this.collectionRef
            .doc(channel.id)
            .collection(FirebaseCollections.Messages)
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                const messages = this.getMessagesFromSnapshot(snapshot);
                cb(null, messages);
            });
    }

    async createChannel(receiver: string, username: string) {
        const userRef = firebase.firestore().collection(FirebaseCollections.Users).doc(receiver)
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error('User doesn\'t exist');
        
        this.collectionRef.add({
            count: 0,
            members: [username, receiver]
        });

    }

    private getMessagesFromSnapshot(snapshot: firebase.firestore.QuerySnapshot): IMessage[] {
        return snapshot.docs.map(d => ({
            ...d.data(),
            createdAt: d.data().createdAt.toDate(),
        })) as IMessage[];
    }

    private updateMessage = async (
        transaction: firebase.firestore.Transaction,
        channel: IChannel,
        message: string,
        username: string
    ) => {
        const channelRef = this.collectionRef.doc(channel.id);
        const snapshot = await transaction.get(channelRef);
        const messagesCount: number = snapshot.data()!.count + 1;
        const messagesCollectionRef = channelRef
            .collection(FirebaseCollections.Messages)
            .doc(messagesCount.toString());

        if (snapshot.exists) {
            transaction.update(channelRef, { count: messagesCount });
            transaction.set(messagesCollectionRef, {
                body: message,
                createdAt: new Date(),
                sender: username,
                receiver: channel.members.filter(e => e !== username)[0],
            });
        }

        return transaction;
    };
}

export default new ChannelsApi();